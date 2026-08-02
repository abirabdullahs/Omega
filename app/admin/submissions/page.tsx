'use client';

import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";
import { Clock, User, Search, Trash2, X, ListFilter, CheckCircle2 } from "lucide-react";

interface TaskOption {
  id: string;
  title: string;
}

interface Submission {
  id: string;
  taskId: string;
  taskTitle: string;
  studentId: string;
  studentName?: string | null;
  studentPhone: string;
  text: string;
  submittedAt: any;
  grade?: string;
  feedback?: string;
}

export default function AdminSubmissionsPage() {
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "graded">("");

  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { user } = useAuth();
  const toast = useToast();

  // Task list is a single cheap Firestore read — used to populate the
  // filter dropdown. Submissions themselves are only ever fetched for one
  // selected task at a time (see fetchSubmissions), instead of scanning
  // every task's entries on every page load.
  useEffect(() => {
    async function fetchTasks() {
      try {
        const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setTasks(snap.docs.map((d) => ({ id: d.id, title: (d.data() as any).title || "Untitled task" })));
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setTasksLoading(false);
      }
    }
    fetchTasks();
  }, []);

  const fetchSubmissions = async (taskId: string, status: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (taskId) params.set("taskId", taskId);
      if (status) params.set("status", status);
      const res = await fetch(
        `${window.location.origin}/api/admin/submissions?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.items)) {
        setSubmissions(data.items);
      } else {
        console.error('Submissions API error:', data);
        toast.error(data?.error || "Failed to load submissions.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  // Default view: last 10 submissions across all tasks. Selecting a task
  // narrows to that task; the status filter applies either way.
  useEffect(() => {
    if (!user) return;
    fetchSubmissions(selectedTaskId, statusFilter);
  }, [selectedTaskId, statusFilter, user?.uid]);

  useEffect(() => {
    if (!selectedSub) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [selectedSub]);

  const filteredSubmissions = submissions.filter((sub) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (sub.studentName || "").toLowerCase().includes(q) ||
      (sub.studentPhone || "").toLowerCase().includes(q) ||
      (sub.text || "").toLowerCase().includes(q)
    );
  });

  const openGrading = (sub: Submission) => {
    setSelectedSub(sub);
    setGrade(sub.grade || "");
    setFeedback(sub.feedback || "");
  };

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !grade) return;

    setIsGrading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${window.location.origin}/api/admin/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: selectedSub.taskId, entryId: selectedSub.id, grade, feedback }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSelectedSub(null);
        setGrade("");
        setFeedback("");
        fetchSubmissions(selectedTaskId, statusFilter);
        toast.success("Grade saved.");
      } else {
        console.error('Grading API error:', data);
        toast.error(data?.error || "Failed to save grade.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save grade.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleRemove = async (sub: Submission) => {
    if (!confirm(`Remove ${sub.studentName || sub.studentPhone || "this student"}'s submission for "${sub.taskTitle}"? This cannot be undone.`)) return;
    setRemovingId(sub.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        `${window.location.origin}/api/admin/submissions?taskId=${encodeURIComponent(sub.taskId)}&entryId=${encodeURIComponent(sub.id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => !(s.taskId === sub.taskId && s.id === sub.id)));
        if (selectedSub?.taskId === sub.taskId && selectedSub?.id === sub.id) setSelectedSub(null);
        toast.success("Submission removed.");
      } else {
        console.error('Remove submission error:', data);
        toast.error(data?.error || "Failed to remove submission.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove submission.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Student Submissions</h2>
        <p className="text-neutral-500 text-sm">
          {selectedTaskId ? "Reviewing submissions for the selected task." : "Showing the 10 most recent submissions across all tasks."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
        <div className="relative">
          <ListFilter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            disabled={tasksLoading}
            className="w-full appearance-none rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm font-medium text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100 disabled:opacity-50"
          >
            <option value="">{tasksLoading ? "Loading tasks…" : "All tasks (last 10)"}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "pending" | "graded")}
            className="w-full appearance-none rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm font-medium text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending only</option>
            <option value="graded">Graded only</option>
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or answer…"
            className="w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20">
          <Loader label="Loading submissions…" className="text-neutral-900" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="py-20 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-100">
          {submissions.length === 0 ? "No submissions found." : "No submissions match your search."}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => (
            <div
              key={sub.id}
              onClick={() => openGrading(sub)}
              className="w-full text-left bg-white p-5 rounded-2xl border border-neutral-100 hover:border-neutral-300 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <User size={16} className="text-neutral-900" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{sub.studentName || sub.studentPhone || "Student"}</p>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">{sub.taskTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {sub.grade ? (
                    <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Graded: {sub.grade}</span>
                  ) : (
                    <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(sub);
                    }}
                    disabled={removingId === sub.id}
                    aria-label="Remove submission"
                    className="p-1.5 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-500 line-clamp-1 mb-2 italic">&quot;{sub.text}&quot;</p>
              <div className="flex items-center text-[10px] text-neutral-400">
                <Clock size={12} className="mr-1" />
                {formatDateTime(sub.submittedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grading modal — opens centered over the page on any screen size,
          so grading never requires scrolling down to find the form. */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSub(null);
          }}
        >
          <div className="w-full max-w-lg my-8 sm:my-0 rounded-3xl border border-neutral-100 bg-white p-6 sm:p-8 shadow-xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 mb-1">Grade Submission</h3>
                <p className="text-sm text-neutral-500">
                  {selectedSub.studentName || selectedSub.studentPhone} — {selectedSub.taskTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                aria-label="Close"
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Student&apos;s Answer</label>
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-sm text-neutral-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedSub.text}
                </div>
              </div>

              <form onSubmit={handleGrade} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Grade</label>
                  <select
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">Select Grade</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Feedback</label>
                  <textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900"
                    placeholder="Excellent work! Consider focusing on..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGrading}
                  className="w-full bg-neutral-900 text-white py-3 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-sm"
                >
                  {isGrading ? "Saving..." : "Submit Grade & Feedback"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => handleRemove(selectedSub)}
                disabled={removingId === selectedSub.id}
                className="w-full flex items-center justify-center gap-2 text-red-600 text-sm font-bold py-2.5 rounded-2xl border border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                {removingId === selectedSub.id ? "Removing…" : "Remove submission"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
