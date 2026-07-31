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

    // 1. Get all students
    const studentsSnap = await db.collection("users").where("role", "==", "student").get();
    const students = studentsSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));

    // 2. Get tasks with deadlines
    const tasksSnap = await db.collection("tasks").orderBy("createdAt", "desc").get();
    const tasks = tasksSnap.docs
      .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((t: any) => t.deadline);

    const results: any[] = [];

    for (const student of students) {
      const missed: string[] = [];
      const late: string[] = [];

      for (const task of tasks) {
        try {
          const subRef = db.collection("submissions").doc(task.id).collection("entries").doc(student.id);
          const subSnap = await subRef.get();

          let deadlineDate: Date | null = null;
          try {
            const raw = task.deadline;
            if (raw && typeof raw.toDate === "function") deadlineDate = raw.toDate();
            else if (typeof raw === "number") deadlineDate = new Date(raw);
            else deadlineDate = new Date(raw);
          } catch {
            deadlineDate = null;
          }

          if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) continue;

          const now = new Date();

          if (!subSnap.exists) {
            if (now > deadlineDate) missed.push(task.title || task.id);
          } else {
            const submissionData = subSnap.data();
            const rawSub = submissionData?.submittedAt;
            let submittedAt: Date | null = null;
            if (rawSub && typeof rawSub.toDate === "function") submittedAt = rawSub.toDate();
            else if (typeof rawSub === "number") submittedAt = new Date(rawSub);
            else submittedAt = rawSub ? new Date(rawSub) : null;

            if (submittedAt && !Number.isNaN(submittedAt.getTime()) && submittedAt > deadlineDate) {
              late.push(task.title || task.id);
            }
          }
        } catch (err: any) {
          // ignore per-student task read failures, continue
          console.warn("Error checking submission for", student.id, (err as any)?.message || String(err));
        }
      }

      if (missed.length > 0 || late.length > 0) {
        results.push({ student: { id: student.id, name: student.name || null, phone: student.phone || null }, missedTasks: missed, lateTasks: late });
      }
    }

    return NextResponse.json({ items: results });
  } catch (error: any) {
    console.error("Error computing tracking data:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      { error: error?.message || "Failed to compute tracking data", details: initError || undefined },
      { status: 500 }
    );
  }
}
