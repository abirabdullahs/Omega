import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

    const snapshot = await db.collection("chats_meta").get();
    type ChatMetaItem = {
      roomId: string;
      lastMessageAt: number | null;
      lastMessageText: string | null;
      unreadForAdmin: boolean;
      unreadForStudent: boolean;
      updatedAt: number | null;
    };

    const items: ChatMetaItem[] = snapshot.docs
      .map((doc: any) => {
        const data: any = doc.data();
        return {
          roomId: doc.id,
          lastMessageAt: data?.lastMessageAt?.toMillis ? data.lastMessageAt.toMillis() : data?.lastMessageAt || null,
          lastMessageText: data?.lastMessageText || null,
          unreadForAdmin: data?.unreadForAdmin || false,
          unreadForStudent: data?.unreadForStudent || false,
          updatedAt: data?.updatedAt?.toMillis ? data.updatedAt.toMillis() : data?.updatedAt || null,
        };
      })
      .sort((a: ChatMetaItem, b: ChatMetaItem) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("Error fetching admin chat metas:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      { error: error?.message || "Failed to fetch chat meta", details: initError || undefined },
      { status: 500 }
    );
  }
}
