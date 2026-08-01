'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { CheckCircle2, ChevronRight, FileText, MessageSquare } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";

interface Task {
  id: string;
  title: string;
}

interface SubmissionRow {
  taskId: string;
  taskTitle: string;
  text: string;
  submittedAt: any;
  grade?: string;
  feedback?: string;
}

export default function StudentSubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchSubmissions() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const tasksSnap = await getDocs(query(collection(db, "tasks"), orderBy("createdAt", "desc")));
        const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));

        const results: SubmissionRow[] = [];
        for (const task of tasks) {
          const subSnap = await getDoc(doc(db, "submissions", task.id, "entries", user.uid));
          if (subSnap.exists()) {
            const data = subSnap.data();
            results.push({
              taskId: task.id,
              taskTitle: task.title,
              text: data.text,
              submittedAt: data.submittedAt,
              grade: data.grade,
              feedback: data.feedback,
            });
          }
        }
        results.sort((a, b) => {
          const at = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : new Date(a.submittedAt || 0).getTime();
          const bt = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : new Date(b.submittedAt || 0).getTime();
          return bt - at;
        });
        setRows(results);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, [user]);

  if (loading) {
    return (
      <div className="py-24">
        <Loader label="Loading your submissions…" className="text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-neutral-400" />
          My Submissions
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Every task you&apos;ve submitted, with grades and feedback.</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-dashed border-neutral-200 text-center space-y-2">
          <p className="text-neutral-500 font-medium">You haven&apos;t submitted any tasks yet.</p>
          <Link href="/student" className="inline-block text-sm font-bold text-neutral-900 underline">
            View your tasks →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link
              key={row.taskId}
              href={`/student/tasks/${row.taskId}`}
              className="block bg-white p-5 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2.5 rounded-xl shrink-0 ${row.grade ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-neutral-900 truncate">{row.taskTitle}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Submitted {formatDateTime(row.submittedAt) || formatDate(row.submittedAt)}</p>
                    <p className="text-xs text-neutral-400 line-clamp-1 mt-1">{row.text}</p>
                    {row.grade && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Grade: {row.grade}</span>
                        {row.feedback && (
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                            <MessageSquare size={10} /> Feedback given
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-neutral-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
