import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

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

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    try {
      const messagesRef = db.collection("chats").doc(roomId).collection("messages");
      const snap = await messagesRef.get();
      const batchSize = 500;
      let batch = db.batch();
      let opCount = 0;
      for (const doc of snap.docs) {
        batch.delete(messagesRef.doc(doc.id));
        opCount++;
        if (opCount >= batchSize) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
    } catch (err: any) {
      console.error("Error deleting chat messages:", err?.message || String(err));
      return NextResponse.json({ error: "Failed to delete messages" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in admin chat delete:", error?.message || String(error));
    const initError = getAdminInitError();
    return NextResponse.json({ error: error?.message || "Failed to delete chat" , details: initError || undefined }, { status: 500 });
  }
}
