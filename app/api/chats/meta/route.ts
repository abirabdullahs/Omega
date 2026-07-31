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
    const decoded = await auth.verifyIdToken(match[1]);
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    if (!decoded) return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });
    }

    const snapshot = await db.collection("chats_meta").doc(decoded.uid).get();
    if (!snapshot.exists) {
      return NextResponse.json({ success: true, item: null });
    }

    const data: any = snapshot.data();
    return NextResponse.json({
      success: true,
      item: {
        roomId: snapshot.id,
        lastMessageAt: data?.lastMessageAt?.toMillis ? data.lastMessageAt.toMillis() : data?.lastMessageAt || null,
        lastMessageText: data?.lastMessageText || null,
        unreadForStudent: data?.unreadForStudent || false,
        unreadForAdmin: data?.unreadForAdmin || false,
        updatedAt: data?.updatedAt?.toMillis ? data.updatedAt.toMillis() : data?.updatedAt || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching student chat meta:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch chat meta" }, { status: 500 });
  }
}
