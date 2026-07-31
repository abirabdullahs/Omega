'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Clock, User, FileText, ChevronRight, MessageSquare } from "lucide-react";

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

  const fetchSubmissions = async () => {
    try {
      // Fetch all tasks first to map titles
      const tasksSnap = await getDocs(collection(db, "tasks"));
      const taskMap = Object.fromEntries(tasksSnap.docs.map(d => [d.id, d.data().title]));

      // Fetch all students to map names
      const studentsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const studentMap = Object.fromEntries(studentsSnap.docs.map(d => [d.id, d.data().name || d.data().phone]));

      // Fetch submissions
      const allSubmissions: any[] = [];
      for (const taskId of Object.keys(taskMap)) {
        const entriesSnap = await getDocs(collection(db, "submissions", taskId, "entries"));
        entriesSnap.forEach((doc: any) => {
          const data = doc.data();
          allSubmissions.push({
            id: doc.id,
            taskId,
            taskTitle: taskMap[taskId],
            studentName: studentMap[data.studentId],
            ...data,
          });
        });
      }
      
      // Sort by submittedAt desc
      allSubmissions.sort((a, b) => (b.submittedAt?.toMillis ? b.submittedAt.toMillis() : new Date(b.submittedAt || 0).getTime()) - (a.submittedAt?.toMillis ? a.submittedAt.toMillis() : new Date(a.submittedAt || 0).getTime()));
      setSubmissions(allSubmissions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !grade) return;

    setIsGrading(true);
    try {
      const subRef = doc(db, "submissions", selectedSub.taskId, "entries", selectedSub.id);
      await updateDoc(subRef, {
        grade,
        feedback,
      });
      setSelectedSub(null);
      setGrade("");
      setFeedback("");
      fetchSubmissions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGrading(false);
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
            <button
              key={`${sub.taskId}-${sub.studentId}`}
              onClick={() => {
                setSelectedSub(sub);
                setGrade(sub.grade || "");
                setFeedback(sub.feedback || "");
              }}
              className={`w-full text-left bg-white p-5 rounded-2xl border transition-all ${
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
                {sub.grade ? (
                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Graded: {sub.grade}</span>
                ) : (
                  <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>
                )}
              </div>
              <p className="text-xs text-neutral-500 line-clamp-1 mb-2 italic">&quot;{sub.text}&quot;</p>
              <div className="flex items-center text-[10px] text-neutral-400">
                <Clock size={12} className="mr-1" />
                {formatDateTime(sub.submittedAt)}
              </div>
            </button>
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
