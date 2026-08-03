import { getAdminDb } from "@/lib/firebase-admin";
import { findChapterMeta } from "@/lib/subjects";

export interface AssignmentItemLite {
  chapterId: string;
  subjectId: string;
  subjectName?: string | null;
}

export interface TopicLite {
  id: string;
  chapterId: string;
  name: string;
  status: "pending" | "submitted";
  order: number;
}

export interface CycleDoc {
  studentId: string;
  subjectOrder: string[];
  cursor: number;
  topicIndexBySubject: Record<string, number>;
  updatedAt?: any;
}

/**
 * Loads (or lazily creates) a student's rotation state, and keeps
 * subjectOrder in sync with whatever subjects are currently assigned —
 * newly assigned subjects are appended to the end so existing order/
 * progress for subjects the student already had is never disturbed.
 */
export async function getOrInitCycle(studentId: string, assignedSubjectIds: string[]): Promise<CycleDoc> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const ref = db.collection("studyCycles").doc(studentId);
  const snap = await ref.get();

  let cycle: CycleDoc;
  if (snap.exists) {
    cycle = snap.data() as CycleDoc;
    if (!Array.isArray(cycle.subjectOrder)) cycle.subjectOrder = [];
    if (!cycle.topicIndexBySubject) cycle.topicIndexBySubject = {};
    if (typeof cycle.cursor !== "number") cycle.cursor = 0;
  } else {
    cycle = { studentId, subjectOrder: [], cursor: 0, topicIndexBySubject: {} };
  }

  // Append newly-assigned subjects that aren't in the order yet.
  const missing = assignedSubjectIds.filter((sid) => !cycle.subjectOrder.includes(sid));
  if (missing.length > 0 || !snap.exists) {
    cycle.subjectOrder = [...cycle.subjectOrder, ...missing];
    await ref.set(
      {
        studentId,
        subjectOrder: cycle.subjectOrder,
        cursor: cycle.cursor,
        topicIndexBySubject: cycle.topicIndexBySubject,
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }

  return cycle;
}

/**
 * Finds the single "current" topic the student should be working on right
 * now: starting at the cycle's cursor, walk subjectOrder (wrapping around)
 * until we find a subject that has an assigned chapter with a topic
 * waiting at its tracked index. Subjects with no chapter, or whose
 * chapter has no topics left, are skipped.
 */
export function resolveCurrentTopic(
  cycle: CycleDoc,
  assignedItems: AssignmentItemLite[],
  topicsBySubject: Record<string, TopicLite[]>
) {
  const bySubject: Record<string, AssignmentItemLite> = {};
  assignedItems.forEach((it) => {
    bySubject[it.subjectId] = it;
  });

  const order = cycle.subjectOrder.length > 0 ? cycle.subjectOrder : Object.keys(bySubject);
  if (order.length === 0) return null;

  const start = ((cycle.cursor % order.length) + order.length) % order.length;
  for (let i = 0; i < order.length; i++) {
    const idx = (start + i) % order.length;
    const subjectId = order[idx];
    const assignment = bySubject[subjectId];
    if (!assignment) continue;

    const topics = (topicsBySubject[subjectId] || [])
      .filter((t) => t.chapterId === assignment.chapterId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const topicIdx = cycle.topicIndexBySubject[subjectId] ?? 0;
    const topic = topics[topicIdx];
    if (!topic) continue;

    const chapterMeta = findChapterMeta(assignment.chapterId);
    return {
      subjectId,
      subjectName: assignment.subjectName || chapterMeta?.subject.name || subjectId,
      chapterId: assignment.chapterId,
      chapterName: chapterMeta?.chapter.name || assignment.chapterId,
      topic,
      topicIndex: topicIdx,
      topicsInChapter: topics.length,
      subjectCursorIndex: idx,
    };
  }

  return null;
}
