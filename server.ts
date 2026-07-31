import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { db, adminInitError } from "./lib/firebase-admin.ts";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("join", (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("send_message", async (data) => {
      const { roomId, senderId, senderName, text, role } = data;

      const messageData = {
        senderId,
        senderName,
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
        // Persist to Firestore for the 10-minute window
        await db.collection("chats").doc(roomId).collection("messages").add(messageData);

        // Broadcast to the room
        io.to(roomId).emit("receive_message", messageData);
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
    // Background Cleanup Job: Every 1 minute, delete messages older than 10 minutes
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

  // Next.js handler
  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(3000, () => {
    console.log("> Ready on http://localhost:3000");
  });
});
