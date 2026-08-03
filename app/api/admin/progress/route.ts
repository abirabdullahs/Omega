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

    const [assignmentsSnap, studentsSnap, topicsSnap] = await Promise.all([
      db.collection("assignments").get(),
      db.collection("users").where("role", "==", "student").get(),
      db.collection("topics").get(),
    ]);

    // studentId -> chapterId -> { submitted, total }
    const progressByStudentChapter: Record<string, Record<string, { submitted: number; total: number }>> = {};
    topicsSnap.docs.forEach((d: any) => {
      const data = d.data();
      const sid = data.studentId;
      const cid = data.chapterId;
      if (!sid || !cid) return;
      if (!progressByStudentChapter[sid]) progressByStudentChapter[sid] = {};
      if (!progressByStudentChapter[sid][cid]) progressByStudentChapter[sid][cid] = { submitted: 0, total: 0 };
      progressByStudentChapter[sid][cid].total += 1;
      if (data.status === "submitted") progressByStudentChapter[sid][cid].submitted += 1;
    });

    const studentsById: Record<string, any> = {};
    studentsSnap.docs.forEach((d: any) => {
      studentsById[d.id] = { id: d.id, ...d.data() };
    });

    // Group assignments by student, keeping the most recent "running" one
    // (and falling back to the latest overall if none are running).
    const byStudent: Record<string, any> = {};
    assignmentsSnap.docs.forEach((d: any) => {
      const data = d.data();
      const userId = data.userId;
      if (!userId) return;
      const current = byStudent[userId];
      const isBetter =
        !current ||
        (data.status === "running" && current.status !== "running") ||
        (data.status === current.status && (data.createdAt || 0) > (current.createdAt || 0));
      if (isBetter) {
        byStudent[userId] = { id: d.id, ...data };
      }
    });

    const items = Object.entries(byStudent).map(([userId, assignment]) => {
      const chapterProgress = progressByStudentChapter[userId] || {};
      const enrichedItems = (assignment.items || []).map((it: any) => ({
        ...it,
        progress: chapterProgress[it.chapterId] || null,
      }));
      return {
        student: studentsById[userId]
          ? { id: userId, name: studentsById[userId].name || null, phone: studentsById[userId].phone || null }
          : { id: userId, name: null, phone: null },
        assignment: { ...assignment, items: enrichedItems },
      };
    });

    // Also include students who have no assignment at all, so the admin
    // sees the full roster and who hasn't been assigned anything yet.
    const assignedIds = new Set(Object.keys(byStudent));
    studentsSnap.docs.forEach((d: any) => {
      if (!assignedIds.has(d.id)) {
        const data = d.data();
        items.push({
          student: { id: d.id, name: data.name || null, phone: data.phone || null },
          assignment: null,
        });
      }
    });

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing student progress:", err);
    return NextResponse.json({ error: err?.message || "Failed to list student progress", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
