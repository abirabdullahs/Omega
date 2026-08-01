'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Clock, User, FileText, ChevronRight, MessageSquare, Trash2 } from "lucide-react";

interface Submission {
  id: string;
  taskId: string;
  taskTitle: string;
  studentId: string;
  studentPhone: string;
  text: string;
  submittedAt: any;
  grade?: string;
  feedback?: string;
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { user } = useAuth();
  const toast = useToast();

  const fetchSubmissions = async () => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${window.location.origin}/api/admin/submissions`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.items)) {
        setSubmissions(data.items);
      } else {
        console.error('Submissions API error:', data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [user?.uid]);

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !grade) return;

    setIsGrading(true);
    try {
      // Use admin API for grading (PATCH or POST) would be better, but for now use Admin submissions endpoint via fetch.
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
        fetchSubmissions();
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
    if (!confirm(`Remove ${(sub as any).studentName || sub.studentPhone || "this student"}'s submission for "${sub.taskTitle}"? This cannot be undone.`)) return;
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
        <p className="text-neutral-500 text-sm">Review and grade completed tasks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-neutral-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="py-20 text-center text-neutral-400 bg-white rounded-2xl border border-neutral-100">
              No submissions found.
            </div>
          ) : submissions.map((sub) => (
            <div
              key={`${sub.taskId}-${sub.studentId}`}
              onClick={() => {
                setSelectedSub(sub);
                setGrade(sub.grade || "");
                setFeedback(sub.feedback || "");
              }}
              className={`w-full text-left bg-white p-5 rounded-2xl border transition-all cursor-pointer ${
                selectedSub?.taskId === sub.taskId && selectedSub?.studentId === sub.studentId
                  ? "border-neutral-900 ring-1 ring-neutral-900 shadow-md"
                  : "border-neutral-100 hover:border-neutral-200"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <User size={16} className="text-neutral-900" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{(sub as any).studentName || sub.studentPhone || "Student"}</p>
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

        {/* Grading Panel */}
        <div>
          {selectedSub ? (
            <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm sticky top-8">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-neutral-900 mb-1">Grade Submission</h3>
                <p className="text-sm text-neutral-500">Reviewing task for student {(selectedSub as any).studentName || selectedSub.studentPhone}</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Student&apos;s Answer</label>
                  <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 text-sm text-neutral-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedSub.text}
                  </div>
                </div>

                <form onSubmit={handleGrade} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-100 rounded-3xl text-neutral-300 p-20 text-center">
              <div>
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">Select a submission to start grading</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
