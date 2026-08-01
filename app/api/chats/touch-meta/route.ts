import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";

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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating chat meta:", error);
    return NextResponse.json({ error: error?.message || "Failed to update chat meta" }, { status: 500 });
  }
}
