import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import express from "express";
import { getAdminAuth, getAdminDb, getAdminInitError } from "./lib/firebase-admin.ts";
import { findChapterMeta } from "./lib/subjects.ts";

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
        // Check running assignments for expired per-subject deadlines and auto-create requests
        try {
          const now = Date.now();
          const runningSnap = await db.collection("assignments").where("status", "==", "running").get();
          for (const aDoc of runningSnap.docs) {
            const aData: any = aDoc.data();
            const items: any[] = Array.isArray(aData.items) ? aData.items : [];
            let modified = false;
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              // Skip if already notified/handled
              if (item && item.notified) continue;
              const deadlineTs = item?.deadline;
              let deadlineMs = null;
              if (deadlineTs && typeof deadlineTs.toMillis === 'function') {
                deadlineMs = deadlineTs.toMillis();
              } else if (deadlineTs && deadlineTs._seconds) {
                deadlineMs = (deadlineTs._seconds * 1000) + (deadlineTs._nanoseconds || 0) / 1e6;
              }
              if (deadlineMs && deadlineMs <= now) {
                // Deadline expired for this subject item — create a new request containing remaining chapters for that subject
                const userId = aData.userId;
                const chapterId = item.chapterId;
                const subjectId = item.subjectId;

                try {
                  // Gather all requested chapters for the user (recent requests)
                  const reqSnap = await db.collection("requests").where("userId", "==", userId).orderBy("createdAt", "desc").limit(20).get();
                  const requestedSet = new Set<string>();
                  for (const r of reqSnap.docs) {
                    const rd: any = r.data();
                    if (Array.isArray(rd.requestedChapters)) {
                      rd.requestedChapters.forEach((c: string) => requestedSet.add(c));
                    }
                  }

                  // Filter requested chapters to this subject
                  const requestedForSubject = Array.from(requestedSet).filter((cid) => {
                    const meta = findChapterMeta(cid);
                    return meta?.subject.id === subjectId;
                  });

                  // Gather already assigned/completed chapters for this user & subject
                  const assignSnap = await db.collection("assignments").where("userId", "==", userId).get();
                  const assignedSet = new Set<string>();
                  for (const a of assignSnap.docs) {
                    const ad: any = a.data();
                    const its: any[] = Array.isArray(ad.items) ? ad.items : [];
                    its.forEach((it) => {
                      if (it && it.subjectId === subjectId && it.chapterId) assignedSet.add(it.chapterId);
                    });
                  }

                  // Remaining chapters are requestedForSubject minus assignedSet
                  const remaining = requestedForSubject.filter((cid) => !assignedSet.has(cid));

                  if (remaining.length > 0) {
                    // Ensure we don't already have a pending request for any of these chapters
                    const pendingSnap = await db.collection("requests").where("userId", "==", userId).where("status", "==", "pending").get();
                    let alreadyPending = false;
                    for (const p of pendingSnap.docs) {
                      const pd: any = p.data();
                      if (Array.isArray(pd.requestedChapters) && pd.requestedChapters.some((c: string) => remaining.includes(c))) {
                        alreadyPending = true;
                        break;
                      }
                    }

                    if (!alreadyPending) {
                      await db.collection("requests").add({
                        userId,
                        userName: aData.userName || "",
                        userPhone: aData.userPhone || "",
                        requestedChapters: remaining,
                        status: "pending",
                        autoGenerated: true,
                        subjectId,
                        createdAt: new Date(),
                      });
                      console.log(`Auto-created subject-specific request for user ${userId}, subject ${subjectId}`);
                    }
                  }
                } catch (errReq) {
                  console.error("Error building subject-specific request:", errReq);
                }

                // mark item as notified/expired so we don't recreate repeatedly
                items[i] = { ...item, notified: true, status: "expired" };
                modified = true;
              }
            }
            if (modified) {
              await db.collection("assignments").doc(aDoc.id).update({ items });
            }
          }
        } catch (err) {
          console.error("Assignment expiry check error:", err);
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
