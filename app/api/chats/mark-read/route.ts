import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function verifyIdTokenFromHeader(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const auth = getAdminAuth();
  if (!auth) return null;
  try {
    return await auth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    if (!decoded) return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });
    }

    await db.collection("chats_meta").doc(decoded.uid).set(
      {
        unreadForStudent: false,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error marking student chat read:", error);
    return NextResponse.json({ error: error?.message || "Failed to mark chat read" }, { status: 500 });
  }
}
