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

    // Build a query that filters at Firestore level where possible to avoid
    // downloading large result sets and doing client-side filtering.
    let allSubmissions: any[] = [];

    // Helper to map a query snapshot to the common response shape.
    async function mapEntriesSnap(snapshot: FirebaseFirestore.QuerySnapshot) {
      const taskTitleCache: Record<string, string> = {};
      const out: any[] = [];
      for (const entry of snapshot.docs) {
        const data = entry.data() || {};
        // When using collectionGroup the parent is submissions/{taskId}
        const taskRef = (entry.ref as any).parent.parent;
        const taskIdForEntry = taskRef?.id || "";
        if (taskIdForEntry && !(taskIdForEntry in taskTitleCache)) {
          try {
            const taskSnap = await taskRef!.get();
            taskTitleCache[taskIdForEntry] = (taskSnap.data() || {}).title || "";
          } catch (e) {
            taskTitleCache[taskIdForEntry] = "";
          }
        }

        out.push({
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
      return out;
    }

    try {
      if (!taskId) {
          // Recent across all tasks: collectionGroup queries require a special
          // collection-group index which may not be available in all projects
          // immediately. Instead, fetch the most recently-updated tasks and
          // read each task's latest entries (bounded) then merge/sort in memory.
          const recentTasksSnap = await db.collection("tasks").orderBy("updatedAt", "desc").limit(20).get();
          const taskIds: string[] = recentTasksSnap.docs.map((d: any) => d.id);

          const fetchedEntries: any[] = [];
          for (const tId of taskIds) {
            const entriesSnap = await db.collection("submissions").doc(tId).collection("entries").orderBy("submittedAt", "desc").limit(5).get();
            for (const entry of entriesSnap.docs) {
              const data = entry.data() || {};
              fetchedEntries.push({ doc: entry, data, taskId: tId });
            }
          }

          // Map to response shape and sort by submittedAt desc
          const taskTitleCache: Record<string, string> = {};
          const out: any[] = [];
          for (const item of fetchedEntries) {
            const entry = item.doc;
            const data = item.data;
            const taskIdForEntry = item.taskId || "";
            if (taskIdForEntry && !(taskIdForEntry in taskTitleCache)) {
              try {
                const taskSnap = await db.collection("tasks").doc(taskIdForEntry).get();
                taskTitleCache[taskIdForEntry] = (taskSnap.data() || {}).title || "";
              } catch (e) {
                taskTitleCache[taskIdForEntry] = "";
              }
            }

            out.push({
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

          out.sort((a, b) => {
            const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            return tb - ta;
          });

          if (statusFilter === "pending") {
            allSubmissions = out.filter((s) => !s.grade).slice(0, 10);
          } else if (statusFilter === "graded") {
            allSubmissions = out.filter((s) => !!s.grade).slice(0, 10);
          } else {
            allSubmissions = out.slice(0, 10);
          }

          return NextResponse.json({ items: allSubmissions, scope: "recent" });
      }

      const taskDoc = await db.collection("tasks").doc(taskId).get();
      if (!taskDoc.exists) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      const taskTitle = (taskDoc.data() || {}).title || "";

      // Query the specific task's entries subcollection and push filtering
      // into Firestore instead of pulling everything and filtering in JS.
      let entriesRef: FirebaseFirestore.Query = db.collection("submissions").doc(taskId).collection("entries");
      if (statusFilter === "pending") {
        entriesRef = entriesRef.where("grade", "==", null).orderBy("submittedAt", "desc");
      } else if (statusFilter === "graded") {
        entriesRef = entriesRef.where("grade", "!=", null).orderBy("grade", "asc").orderBy("submittedAt", "desc");
      } else {
        entriesRef = entriesRef.orderBy("submittedAt", "desc");
      }

      const entriesSnap = await entriesRef.get();
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

      return NextResponse.json({ items: allSubmissions, scope: "task" });
    } catch (err: any) {
      // If a Firestore query fails (missing index or other), fall back to the
      // previous behavior and do server-side filtering in memory so the
      // endpoint remains functional while surfacing the error to logs.
      console.error("Firestore filtered query failed, falling back:", err);

      // Fallback: previous behavior — recent (collectionGroup) or full task
      // entries fetch then JS filtering.
      if (!taskId) {
        const cgSnap = await db.collectionGroup("entries").orderBy("submittedAt", "desc").limit(10).get();
        const taskTitleCache: Record<string, string> = {};
        for (const entry of cgSnap.docs) {
          const data = entry.data() || {};
          const taskRef = entry.ref.parent.parent;
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

        return NextResponse.json({ items: allSubmissions, scope: "recent", fallback: true });
      }

      const taskDoc2 = await db.collection("tasks").doc(taskId).get();
      if (!taskDoc2.exists) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      const taskTitle2 = (taskDoc2.data() || {}).title || "";
      const entriesSnap2 = await db.collection("submissions").doc(taskId).collection("entries").get();
      entriesSnap2.docs.forEach((entry: any) => {
        const data = entry.data() || {};
        allSubmissions.push({
          id: entry.id,
          taskId,
          taskTitle: taskTitle2,
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

      allSubmissions.sort((a, b) => {
        const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return tb - ta;
      });

      return NextResponse.json({ items: allSubmissions, scope: "task", fallback: true });
    }
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
