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

    // Fetch tasks
    const tasksSnap = await db.collection("tasks").get();
    const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));

    // Fetch students (only those with role=student)
    const studentsSnap = await db.collection("users").where("role", "==", "student").get();
    const studentMap: Record<string, string> = {};
    studentsSnap.docs.forEach((d: any) => {
      const data = d.data() || {};
      studentMap[d.id] = data.name || data.phone || "";
    });

    // Collect submissions across tasks
    const allSubmissions: any[] = [];
    for (const task of tasks) {
      try {
        const entriesSnap = await db.collection("submissions").doc(task.id).collection("entries").get();
        entriesSnap.docs.forEach((entry: any) => {
          const data = entry.data() || {};
          allSubmissions.push({
            id: entry.id,
            taskId: task.id,
            taskTitle: task.title || "",
            studentId: data.studentId,
            studentPhone: data.studentPhone || "",
            studentName: studentMap[data.studentId] || null,
            text: data.text || "",
            submittedAt: data.submittedAt || null,
            grade: data.grade || null,
            feedback: data.feedback || null,
          });
        });
      } catch (err) {
        console.warn("Error reading entries for task", task.id, err?.message || err);
      }
    }

    // sort by submittedAt desc (handle timestamp or number)
    allSubmissions.sort((a, b) => {
      const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ items: allSubmissions });
  } catch (error: any) {
    console.error("Error listing submissions:", error);
    const initError = getAdminInitError();
    return NextResponse.json({ error: error?.message || "Failed to list submissions", details: initError || undefined }, { status: 500 });
  }
}
