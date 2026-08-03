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
  currentDeadlineAt?: number | null;
  updatedAt?: any;
}

export const TOPIC_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * Lazily starts a fresh 24h deadline the first time a topic becomes
 * "current" and no deadline has been set yet (e.g. right after the very
 * first topic is added). Submitting is what moves the deadline forward
 * after that — see /api/topics/submit.
 */
export async function ensureDeadline(studentId: string, cycle: CycleDoc, hasCurrentTopic: boolean): Promise<CycleDoc> {
  if (cycle.currentDeadlineAt || !hasCurrentTopic) return cycle;

  const db = getAdminDb();
  if (!db) return cycle;

  const currentDeadlineAt = Date.now() + TOPIC_DEADLINE_MS;
  await db.collection("studyCycles").doc(studentId).set({ currentDeadlineAt }, { merge: true });
  return { ...cycle, currentDeadlineAt };
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

/**
 * Loads everything needed to know a student's current rotation state:
 * their assigned chapters, all their topics grouped by subject, the
 * cycle doc (auto-synced), the resolved current topic, and its deadline
 * (lazily started if this is the very first topic).
 */
export async function loadStudentCycleState(studentId: string) {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const [assignmentsSnap, topicsSnap] = await Promise.all([
    db.collection("assignments").where("userId", "==", studentId).where("status", "==", "running").limit(1).get(),
    db.collection("topics").where("studentId", "==", studentId).get(),
  ]);

  const assignedItems: AssignmentItemLite[] = assignmentsSnap.empty ? [] : (assignmentsSnap.docs[0].data().items || []);
  const assignedSubjectIds = assignedItems.map((it) => it.subjectId).filter(Boolean);

  const topicsBySubject: Record<string, TopicLite[]> = {};
  topicsSnap.docs.forEach((d: any) => {
    const data = d.data();
    const topic: TopicLite = { id: d.id, chapterId: data.chapterId, name: data.name, status: data.status || "pending", order: data.order ?? 0 };
    if (!topicsBySubject[data.subjectId]) topicsBySubject[data.subjectId] = [];
    topicsBySubject[data.subjectId].push(topic);
  });

  const cycle = await getOrInitCycle(studentId, assignedSubjectIds);
  const currentTopic = resolveCurrentTopic(cycle, assignedItems, topicsBySubject);
  const cycleWithDeadline = await ensureDeadline(studentId, cycle, !!currentTopic);

  return { cycle: cycleWithDeadline, assignedItems, topicsBySubject, currentTopic };
}
