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
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.roomId !== "string") {
      return NextResponse.json({ error: "Missing or invalid roomId" }, { status: 400 });
    }

    await db.collection("chats_meta").doc(body.roomId).set(
      {
        unreadForAdmin: false,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error marking admin chat read:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      { error: error?.message || "Failed to mark chat read", details: initError || undefined },
      { status: 500 }
    );
  }
}
