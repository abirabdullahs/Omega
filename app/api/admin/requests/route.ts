import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const snap = await db.collection("requests").where("status", "==", "pending").orderBy("createdAt", "desc").get();
    const items = await Promise.all(snap.docs.map(async (d: any) => {
      const data = d.data();
      let user: any = null;
      try {
        const u = await db.collection("users").doc(data.userId).get();
        user = u.exists ? u.data() : null;
      } catch {
        user = null;
      }
      return { id: d.id, ...data, user };
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing requests:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Failed to list requests", details: initError || undefined }, { status: 500 });
  }
}

/**
 * POST body: { requestId: string, items: Array<{chapterId, subjectId, subjectName, deadlineMillis}> }
 * This will merge/create assignments for the request owner and update the request's requestedChapters/status.
 */
export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const body = await req.json().catch(() => null);
    if (!body || !body.requestId || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { requestId, items } = body;
    const reqDoc = await db.collection("requests").doc(requestId).get();
    if (!reqDoc.exists) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    const reqData: any = reqDoc.data();
    const userId = reqData.userId;

    // Normalize items: ensure deadlineMillis present
    const newItems = items.map((it: any) => ({
      chapterId: it.chapterId,
      subjectId: it.subjectId,
      subjectName: it.subjectName || null,
      deadlineMillis: Number(it.deadlineMillis) || Date.now(),
    }));

    // Find existing running assignment for user
    const runningSnap = await db.collection("assignments").where("userId", "==", userId).where("status", "==", "running").get();
    if (!runningSnap.empty) {
      const aDoc = runningSnap.docs[0];
      const aData: any = aDoc.data();
      const existingItems: any[] = Array.isArray(aData.items) ? aData.items : [];

      const subjectsToReplace = new Set(newItems.map((i: any) => i.subjectId));
      const filtered = existingItems.filter(it => !subjectsToReplace.has(it.subjectId));
      const mergedItems = [...filtered, ...newItems.map((i: any) => ({ ...i, deadline: i.deadlineMillis }))];

      const latestDeadline = mergedItems.reduce((latest, item) => {
        const t = item.deadline || 0;
        return t > latest ? t : latest;
      }, 0);

      await db.collection("assignments").doc(aDoc.id).update({
        items: mergedItems,
        chapters: Object.fromEntries(mergedItems.map((item: any) => [item.subjectId, item.chapterId])),
        deadline: latestDeadline,
        updatedAt: Date.now(),
      });
    } else {
      const latestDeadline = newItems.reduce((latest: number, item: any) => {
        const t = item.deadlineMillis || 0;
        return t > latest ? t : latest;
      }, 0);
      await db.collection("assignments").add({
        userId,
        items: newItems.map((i: any) => ({ ...i, deadline: i.deadlineMillis })),
        chapters: Object.fromEntries(newItems.map((item: any) => [item.subjectId, item.chapterId])),
        deadline: latestDeadline,
        status: "running",
        createdAt: Date.now(),
      });
    }

    // Update request: remove assigned chapters
    const assignedChapterIds = newItems.map((it: any) => it.chapterId);
    const remaining = (reqData.requestedChapters || []).filter((cid: any) => !assignedChapterIds.includes(cid));
    await db.collection("requests").doc(requestId).update({ requestedChapters: remaining, status: remaining.length === 0 ? "approved" : "partial", updatedAt: Date.now() });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error handling admin assign:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Server error", details: initError || undefined }, { status: 500 });
  }
}
