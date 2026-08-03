'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getChapterName } from "@/lib/subjects";
import { formatDate } from "@/lib/utils";
import { BookMarked, Search, User, AlertTriangle } from "lucide-react";
import { Loader } from "@/components/ui/loader";

interface AssignmentItem {
  chapterId: string;
  subjectId: string;
  subjectName?: string | null;
  deadline?: number;
  deadlineMillis?: number;
  progress?: { submitted: number; total: number } | null;
}

interface ProgressRow {
  student: { id: string; name: string | null; phone: string | null };
  assignment: {
    id: string;
    items: AssignmentItem[];
    deadline?: number;
    status?: string;
  } | null;
}

export default function AdminProgressPage() {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    async function fetchProgress() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/progress", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data?.items)) {
          setRows(data.items);
        } else {
          console.error("Progress API error:", data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, [user]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.student.name || "").toLowerCase().includes(q) || (r.student.phone || "").includes(q);
  });

  // Students actively working through chapters first, then unassigned ones.
  filtered.sort((a, b) => {
    const aRunning = a.assignment?.status === "running" ? 1 : 0;
    const bRunning = b.assignment?.status === "running" ? 1 : 0;
    return bRunning - aRunning;
  });

  if (loading) {
    return (
      <div className="py-24">
        <Loader label="Loading student progress…" className="text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-neutral-400" />
          Student Progress
        </h2>
        <p className="text-neutral-500 text-sm mt-1">Which chapters each student is currently working through.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
            No students found.
          </div>
        )}
        {filtered.map((row) => {
          const items = row.assignment?.items || [];
          const isRunning = row.assignment?.status === "running";
          const deadline = row.assignment?.deadline;
          const isOverdue = isRunning && deadline && deadline < Date.now();

          return (
            <div key={row.student.id} className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                    <User size={18} className="text-neutral-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{row.student.name || "Unnamed student"}</p>
                    <p className="text-xs text-neutral-400">{row.student.phone}</p>
                  </div>
                </div>
                {items.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        <AlertTriangle size={11} /> Overdue
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${isRunning ? "text-blue-600 bg-blue-50" : "text-neutral-500 bg-neutral-100"}`}>
                      {row.assignment?.status || "unknown"}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold uppercase text-neutral-400 bg-neutral-100 px-2 py-1 rounded-full">
                    No chapters assigned
                  </span>
                )}
              </div>

              {items.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {items.map((it, idx) => {
                    const chapterName = getChapterName(it.chapterId) || it.chapterId;
                    const itemDeadline = it.deadline || it.deadlineMillis;
                    const progress = it.progress;
                    const pct = progress && progress.total > 0 ? Math.round((progress.submitted / progress.total) * 100) : null;
                    return (
                      <div key={idx} className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{it.subjectName || it.subjectId}</p>
                        <p className="text-sm font-medium text-neutral-900 mt-0.5">{chapterName}</p>
                        {itemDeadline ? (
                          <p className="text-[11px] text-neutral-500 mt-1">Due {formatDate(itemDeadline)}</p>
                        ) : null}
                        {pct !== null ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                              <span>{progress!.submitted}/{progress!.total} topics</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-neutral-400 mt-2 italic">No topics added yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
