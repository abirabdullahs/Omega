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

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId") || "";
    const statusFilter = searchParams.get("status") || ""; // "pending" | "graded" | ""

    // Fetch students once (small collection) — used to resolve names either way.
    const studentsSnap = await db.collection("users").where("role", "==", "student").get();
    const studentMap: Record<string, string> = {};
    studentsSnap.docs.forEach((d: any) => {
      const data = d.data() || {};
      studentMap[d.id] = data.name || data.phone || "";
    });

    let allSubmissions: any[] = [];

    if (!taskId) {
      // No task selected — show the most recent submissions across every
      // task via a single indexed collection-group query, instead of
      // scanning each task's entries subcollection one by one.
      const cgSnap = await db.collectionGroup("entries").orderBy("submittedAt", "desc").limit(10).get();

      const taskTitleCache: Record<string, string> = {};
      for (const entry of cgSnap.docs) {
        const data = entry.data() || {};
        const taskRef = entry.ref.parent.parent; // submissions/{taskId}
        const taskIdForEntry = taskRef?.id || "";
        if (taskIdForEntry && !(taskIdForEntry in taskTitleCache)) {
          const taskSnap = await taskRef!.get();
          taskTitleCache[taskIdForEntry] = (taskSnap.data() || {}).title || "";
        }
        allSubmissions.push({
          id: entry.id,
          taskId: taskIdForEntry,
          taskTitle: taskTitleCache[taskIdForEntry] || "",
          studentId: data.studentId,
          studentPhone: data.studentPhone || "",
          studentName: studentMap[data.studentId] || null,
          text: data.text || "",
          submittedAt: data.submittedAt || null,
          grade: data.grade || null,
          feedback: data.feedback || null,
        });
      }

      if (statusFilter === "pending") {
        allSubmissions = allSubmissions.filter((s) => !s.grade);
      } else if (statusFilter === "graded") {
        allSubmissions = allSubmissions.filter((s) => !!s.grade);
      }

      return NextResponse.json({ items: allSubmissions, scope: "recent" });
    }

    const taskDoc = await db.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const taskTitle = (taskDoc.data() || {}).title || "";

    const entriesSnap = await db.collection("submissions").doc(taskId).collection("entries").get();
    entriesSnap.docs.forEach((entry: any) => {
      const data = entry.data() || {};
      allSubmissions.push({
        id: entry.id,
        taskId,
        taskTitle,
        studentId: data.studentId,
        studentPhone: data.studentPhone || "",
        studentName: studentMap[data.studentId] || null,
        text: data.text || "",
        submittedAt: data.submittedAt || null,
        grade: data.grade || null,
        feedback: data.feedback || null,
      });
    });

    if (statusFilter === "pending") {
      allSubmissions = allSubmissions.filter((s) => !s.grade);
    } else if (statusFilter === "graded") {
      allSubmissions = allSubmissions.filter((s) => !!s.grade);
    }

    // sort by submittedAt desc (handle timestamp or number)
    allSubmissions.sort((a, b) => {
      const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json({ items: allSubmissions, scope: "task" });
  } catch (error: any) {
    console.error("Error listing submissions:", error);
    const initError = getAdminInitError();
    return NextResponse.json({ error: error?.message || "Failed to list submissions", details: initError || undefined }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Firebase Admin setup is incomplete.", details: getAdminInitError() },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const taskId = typeof body?.taskId === "string" ? body.taskId : "";
    const entryId = typeof body?.entryId === "string" ? body.entryId : "";
    const grade = typeof body?.grade === "string" ? body.grade : "";
    const feedback = typeof body?.feedback === "string" ? body.feedback : "";

    if (!taskId || !entryId || !grade) {
      return NextResponse.json({ error: "Missing taskId, entryId, or grade" }, { status: 400 });
    }

    const ref = db.collection("submissions").doc(taskId).collection("entries").doc(entryId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    await ref.update({ grade, feedback: feedback || null });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error grading submission:", error);
    return NextResponse.json({ error: error?.message || "Failed to grade submission" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: "Firebase Admin setup is incomplete.", details: getAdminInitError() },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId") || "";
    const entryId = searchParams.get("entryId") || "";
    if (!taskId || !entryId) {
      return NextResponse.json({ error: "Missing taskId or entryId" }, { status: 400 });
    }

    const ref = db.collection("submissions").doc(taskId).collection("entries").doc(entryId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    await ref.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting submission:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete submission" }, { status: 500 });
  }
}
