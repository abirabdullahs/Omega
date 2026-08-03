import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { loadStudentCycleState, TOPIC_DEADLINE_MS } from "@/lib/studyCycle";
import { notifyAllAdmins } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;
    if (role !== "student") {
      return NextResponse.json({ error: "Only students can submit their own topics" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const { cycle, currentTopic } = await loadStudentCycleState(uid);
    if (!currentTopic) {
      return NextResponse.json({ error: "You don't have an active topic to submit right now." }, { status: 400 });
    }

    const now = Date.now();

    // Mark the topic itself as submitted (for the Topics pages' status badges).
    await db.collection("topics").doc(currentTopic.topic.id).update({
      status: "submitted",
      submittedAt: now,
    });

    // Extra-time carry-forward: whatever was left on this topic's clock
    // rolls into the next topic's deadline — unless this submission just
    // wrapped the rotation back to the first subject, which always starts
    // a fresh 24h countdown (deadline reset rule).
    const remainingMs = Math.max(0, (cycle.currentDeadlineAt || now) - now);
    const subjectOrder = cycle.subjectOrder;
    const newCursor = (currentTopic.subjectCursorIndex + 1) % Math.max(subjectOrder.length, 1);
    const lapCompleted = newCursor === 0;
    const newDeadlineAt = now + TOPIC_DEADLINE_MS + (lapCompleted ? 0 : remainingMs);

    const newTopicIndexBySubject = {
      ...cycle.topicIndexBySubject,
      [currentTopic.subjectId]: currentTopic.topicIndex + 1,
    };

    await db.collection("studyCycles").doc(uid).set(
      {
        studentId: uid,
        cursor: newCursor,
        topicIndexBySubject: newTopicIndexBySubject,
        currentDeadlineAt: newDeadlineAt,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Resolve what's current now, for the client to render immediately.
    const refreshed = await loadStudentCycleState(uid);

    const studentDoc = await db.collection("users").doc(uid).get();
    const studentName = (studentDoc.data() || {}).name || (studentDoc.data() || {}).phone || "A student";

    notifyAllAdmins({
      type: "submission",
      title: `${studentName} completed "${currentTopic.topic.name}"`,
      body: `${currentTopic.subjectName} — ${currentTopic.chapterName}`,
      link: "/admin/topics",
    }).catch((err) => console.error("Failed to notify admins of topic submission:", err));

    return NextResponse.json({
      success: true,
      completedTopic: { subjectId: currentTopic.subjectId, chapterId: currentTopic.chapterId, name: currentTopic.topic.name },
      lapCompleted,
      currentTopic: refreshed.currentTopic,
      deadlineAt: refreshed.cycle.currentDeadlineAt || null,
    });
  } catch (err: any) {
    console.error("Error submitting topic:", err);
    return NextResponse.json({ error: err?.message || "Failed to submit topic" }, { status: 500 });
  }
}
