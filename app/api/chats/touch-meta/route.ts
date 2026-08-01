import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { notifyAllAdmins, notifyUser } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.slice(0, 500) : "";
    let roomId = typeof body?.roomId === "string" ? body.roomId : "";

    // Students can only ever touch their own room (roomId === their uid).
    // Admins may touch any room, but it must be supplied explicitly.
    if (role === "student") {
      roomId = uid;
    }
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    await db.collection("chats_meta").doc(roomId).set(
      {
        studentId: roomId,
        lastMessageAt: new Date(),
        lastMessageText: text,
        unreadForAdmin: role === "student",
        unreadForStudent: role === "admin",
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // One notification per room that refreshes on every new message, rather
    // than piling up a separate entry for each message in a live chat.
    const notifyPayload = {
      type: "message" as const,
      title: role === "student" ? "New message from a student" : "New message from your mentor",
      body: text || undefined,
      link: role === "student" ? "/admin/chats" : "/student/chat",
    };
    const notifyPromise =
      role === "student"
        ? notifyAllAdmins(notifyPayload, `chat_${roomId}`)
        : notifyUser(roomId, notifyPayload, `chat_${roomId}`);
    notifyPromise.catch((err) => console.error("Failed to fan out message notification:", err));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating chat meta:", error);
    return NextResponse.json({ error: error?.message || "Failed to update chat meta" }, { status: 500 });
  }
}
