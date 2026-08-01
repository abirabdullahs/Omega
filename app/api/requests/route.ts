import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { notifyAllAdmins } from "@/lib/notify";

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
  } catch (err) {
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

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { requestedChapters, userName, userPhone } = body;
    if (!Array.isArray(requestedChapters) || requestedChapters.length === 0) {
      return NextResponse.json({ error: "requestedChapters must be a non-empty array" }, { status: 400 });
    }

    const uid = decoded.uid;

    // Check for existing pending request
    const existingQ = await db.collection("requests").where("userId", "==", uid).orderBy("createdAt", "desc").limit(1).get();
    if (!existingQ.empty) {
      const docSnap = existingQ.docs[0];
      const data = docSnap.data();
      if (data.status === "pending") {
        await db.collection("requests").doc(docSnap.id).update({
          requestedChapters,
          updatedAt: Date.now(),
          userName: userName || data.userName || null,
          userPhone: userPhone || data.userPhone || null,
        });

        notifyAllAdmins({
          type: "request",
          title: `${userName || data.userName || "A student"} updated their chapter request`,
          link: "/admin/requests",
        }, `request_${docSnap.id}`).catch((err) => console.error("Failed to fan out request notification:", err));

        return NextResponse.json({ success: true, updated: true, id: docSnap.id });
      }
    }

    // Create new request
    const newDoc = await db.collection("requests").add({
      userId: uid,
      userName: userName || null,
      userPhone: userPhone || null,
      requestedChapters,
      status: "pending",
      createdAt: Date.now(),
    });

    notifyAllAdmins({
      type: "request",
      title: `${userName || "A student"} sent a chapter request`,
      link: "/admin/requests",
    }, `request_${newDoc.id}`).catch((err) => console.error("Failed to fan out request notification:", err));

    return NextResponse.json({ success: true, id: newDoc.id }, { status: 201 });
  } catch (err: any) {
    console.error("Error in requests POST:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Server error", details: initError || undefined }, { status: 500 });
  }
}
