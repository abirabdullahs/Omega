import { getAdminDb } from "@/lib/firebase-admin";

export interface NotifyPayload {
  type: "task" | "notice" | "message" | "request" | "submission";
  title: string;
  body?: string;
  link?: string;
}

async function fanOut(uids: string[], payload: NotifyPayload, docId?: string) {
  const db = getAdminDb();
  if (!db || uids.length === 0) return;

  const batch = db.batch();
  const now = new Date();
  for (const uid of uids) {
    const itemsRef = db.collection("notifications").doc(uid).collection("items");
    const ref = docId ? itemsRef.doc(docId) : itemsRef.doc();
    batch.set(
      ref,
      {
        type: payload.type,
        title: payload.title,
        body: payload.body || null,
        link: payload.link || null,
        read: false,
        createdAt: now,
      },
      { merge: !!docId }
    );
  }
  await batch.commit();
}

/** Notify every student. Used for: new task, new notice. */
export async function notifyAllStudents(payload: NotifyPayload, docId?: string) {
  const db = getAdminDb();
  if (!db) return;
  const snap = await db.collection("users").where("role", "==", "student").get();
  await fanOut(snap.docs.map((d: any) => d.id), payload, docId);
}

/** Notify every admin. Used for: new request, new submission, student message. */
export async function notifyAllAdmins(payload: NotifyPayload, docId?: string) {
  const db = getAdminDb();
  if (!db) return;
  const snap = await db.collection("users").where("role", "==", "admin").get();
  await fanOut(snap.docs.map((d: any) => d.id), payload, docId);
}

/** Notify a single user. Used for: admin's chat reply to one student. */
export async function notifyUser(uid: string, payload: NotifyPayload, docId?: string) {
  await fanOut([uid], payload, docId);
}
