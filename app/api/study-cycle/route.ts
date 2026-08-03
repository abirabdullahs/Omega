import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { getOrInitCycle, resolveCurrentTopic, type TopicLite } from "@/lib/studyCycle";

export const runtime = "nodejs";

async function loadStudentState(studentId: string) {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const [assignmentsSnap, topicsSnap] = await Promise.all([
    db.collection("assignments").where("userId", "==", studentId).where("status", "==", "running").limit(1).get(),
    db.collection("topics").where("studentId", "==", studentId).get(),
  ]);

  const assignedItems = assignmentsSnap.empty ? [] : (assignmentsSnap.docs[0].data().items || []);
  const assignedSubjectIds = assignedItems.map((it: any) => it.subjectId).filter(Boolean);

  const topicsBySubject: Record<string, TopicLite[]> = {};
  topicsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const topic: TopicLite = { id: d.id, chapterId: data.chapterId, name: data.name, status: data.status || "pending", order: data.order ?? 0 };
    if (!topicsBySubject[data.subjectId]) topicsBySubject[data.subjectId] = [];
    topicsBySubject[data.subjectId].push(topic);
  });

  const cycle = await getOrInitCycle(studentId, assignedSubjectIds);
  const currentTopic = resolveCurrentTopic(cycle, assignedItems, topicsBySubject);

  return { cycle, assignedItems, topicsBySubject, currentTopic };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;

    const { searchParams } = new URL(req.url);
    const studentId = role === "admin" ? searchParams.get("studentId") || "" : uid;
    if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

    const { cycle, currentTopic } = await loadStudentState(studentId);

    return NextResponse.json({
      subjectOrder: cycle.subjectOrder,
      currentTopic,
    });
  } catch (err: any) {
    console.error("Error resolving study cycle:", err);
    return NextResponse.json({ error: err?.message || "Failed to load study cycle", details: getAdminInitError() || undefined }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;
    if (role !== "student") {
      return NextResponse.json({ error: "Only students can reorder their own subjects" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const body = await req.json().catch(() => null);
    const newOrder = Array.isArray(body?.subjectOrder) ? body.subjectOrder.filter((s: any) => typeof s === "string") : null;
    if (!newOrder || newOrder.length === 0) {
      return NextResponse.json({ error: "Missing subjectOrder" }, { status: 400 });
    }

    const ref = db.collection("studyCycles").doc(uid);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() as any) : { subjectOrder: [], cursor: 0, topicIndexBySubject: {} };

    // Only allow reordering subjects that are already part of the cycle —
    // never let a client inject arbitrary subject IDs.
    const validSet = new Set(existing.subjectOrder || []);
    const filteredNewOrder = newOrder.filter((s: string) => validSet.has(s));
    const missing = (existing.subjectOrder || []).filter((s: string) => !filteredNewOrder.includes(s));
    const finalOrder = [...filteredNewOrder, ...missing];

    // Keep the cursor pointing at the same subject as before, just at its
    // new position, so reordering doesn't jump the active topic around.
    const currentSubjectId = (existing.subjectOrder || [])[existing.cursor % Math.max(existing.subjectOrder?.length || 1, 1)];
    const newCursor = currentSubjectId ? Math.max(finalOrder.indexOf(currentSubjectId), 0) : 0;

    await ref.set(
      { studentId: uid, subjectOrder: finalOrder, cursor: newCursor, topicIndexBySubject: existing.topicIndexBySubject || {}, updatedAt: new Date() },
      { merge: true }
    );

    return NextResponse.json({ success: true, subjectOrder: finalOrder });
  } catch (err: any) {
    console.error("Error updating study cycle order:", err);
    return NextResponse.json({ error: err?.message || "Failed to update order" }, { status: 500 });
  }
}
