import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() || undefined }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const roomId = body?.roomId;
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    // Delete all messages in the room's messages subcollection
    const messagesRef = db.collection("chats").doc(roomId).collection("messages");
    const snapshot = await messagesRef.get();
    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error completing chat session:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Failed to complete chat session", details: initError || undefined }, { status: 500 });
  }
}
