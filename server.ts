import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { getAdminAuth, getAdminDb, getAdminInitError } from "./lib/firebase-admin.ts";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const appOrigin = process.env.APP_URL || "http://localhost:3000";

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer, {
    cors: {
      origin: appOrigin,
    },
  });

  const auth = getAdminAuth();
  const db = getAdminDb();
  const adminInitError = getAdminInitError();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || !auth || !db) {
        return next(new Error("Unauthorized"));
      }

      const decoded = await auth.verifyIdToken(token);
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (!userDoc.exists) {
        return next(new Error("Unauthorized"));
      }

      const profile = userDoc.data();
      socket.data.uid = decoded.uid;
      socket.data.role = profile?.role;
      socket.data.name = profile?.name || profile?.phone || "User";
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join", (roomId: string) => {
      if (!roomId || typeof roomId !== "string") return;

      const { uid, role } = socket.data;
      if (role === "student" && roomId !== uid) {
        socket.emit("error_message", { error: "Cannot join another student's chat" });
        return;
      }
      if (role !== "admin" && role !== "student") {
        socket.emit("error_message", { error: "Unauthorized role" });
        return;
      }

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("send_message", async (data: { roomId?: string; text?: string }) => {
      const roomId = data?.roomId;
      const text = typeof data?.text === "string" ? data.text.trim() : "";
      if (!roomId || !text) return;

      const { uid, role, name } = socket.data;
      if (role === "student" && roomId !== uid) {
        socket.emit("error_message", { error: "Cannot send to another student's chat" });
        return;
      }
      if (role !== "admin" && role !== "student") return;

      const messageData = {
        senderId: uid,
        senderName: name,
        text,
        role,
        createdAt: new Date(),
      };

      if (!db) {
        console.warn("Firestore Admin SDK unavailable; broadcasting message without persistence.", adminInitError);
        io.to(roomId).emit("receive_message", messageData);
        return;
      }

      try {
        const docRef = await db.collection("chats").doc(roomId).collection("messages").add(messageData);
        io.to(roomId).emit("receive_message", { id: docRef.id, ...messageData });
      } catch (error) {
        console.error("Error saving message:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  if (!db) {
    console.warn("Firestore Admin SDK unavailable; cleanup job disabled.", adminInitError);
  } else {
    setInterval(async () => {
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const chatsSnapshot = await db.collection("chats").get();

        for (const chatDoc of chatsSnapshot.docs) {
          const messagesRef = chatDoc.ref.collection("messages");
          const oldMessagesSnapshot = await messagesRef
            .where("createdAt", "<", tenMinutesAgo)
            .get();

          if (!oldMessagesSnapshot.empty) {
            const batch = db.batch();
            oldMessagesSnapshot.docs.forEach((doc: any) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`Deleted ${oldMessagesSnapshot.size} old messages from chat ${chatDoc.id}`);
          }
        }
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }, 60 * 1000);
  }

  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(3000, () => {
    console.log("> Ready on http://localhost:3000");
  });
});
