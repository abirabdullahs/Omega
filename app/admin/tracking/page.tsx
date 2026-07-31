'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import { Clock, AlertCircle, Trash2, ShieldAlert } from "lucide-react";

interface Student {
  id: string;
  email: string;
  phone: string;
  name?: string;
}

interface Task {
  id: string;
  title: string;
  deadline: any;
}

interface DefaulterInfo {
  student: Student;
  missedTasks: string[];
  lateTasks: string[];
}

export default function TrackingPage() {
  const [defaulters, setDefaulters] = useState<DefaulterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPerformanceData = async () => {
    try {
      // 1. Get all students
      const studentSnap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const students = studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));

      // 2. Get all tasks with deadlines
      const taskSnap = await getDocs(query(collection(db, "tasks"), orderBy("createdAt", "desc")));
      const tasksWithDeadlines = taskSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Task))
        .filter(t => t.deadline);

      const results: DefaulterInfo[] = [];

      // 3. For each student, check their submissions against deadlines
      for (const student of students) {
        const missed: string[] = [];
        const late: string[] = [];

        for (const task of tasksWithDeadlines) {
          const subRef = doc(db, "submissions", task.id, "entries", student.id);
          const subSnap = await getDoc(subRef);

          const deadlineDate = typeof task.deadline?.toDate === "function" ? task.deadline.toDate() : new Date(task.deadline);
          if (Number.isNaN(deadlineDate.getTime())) continue;

          const now = new Date();

          if (!subSnap.exists()) {
            if (now > deadlineDate) {
              missed.push(task.title);
            }
          } else {
            const submissionData = subSnap.data();
            const rawSub = submissionData.submittedAt;
            const submittedAt = typeof rawSub?.toDate === "function" ? rawSub.toDate() : rawSub ? new Date(rawSub) : null;
            if (submittedAt && !Number.isNaN(submittedAt.getTime()) && submittedAt > deadlineDate) {
              late.push(task.title);
            }
          }
        }

        if (missed.length > 0 || late.length > 0) {
          results.push({ student, missedTasks: missed, lateTasks: late });
        }
      }

      setDefaulters(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student from the programme? This action is permanent.")) return;
    if (!user) {
      alert("You must be signed in to remove a student.");
      return;
    }

    setRemovingId(studentId);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/students?studentId=${studentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDefaulters(prev => prev.filter(d => d.student.id !== studentId));
        alert("Student removed successfully.");
      } else {
        alert(data.error || "Failed to remove student. Auth and profile were not deleted.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to remove student.");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) return <div className="py-20 text-center text-neutral-400">Analyzing submission records...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Defaulter Tracking</h2>
        <p className="text-neutral-500 text-sm">Students who missed deadlines or have not submitted tasks on time.</p>
      </div>

      {defaulters.length === 0 ? (
        <div className="bg-white p-20 rounded-3xl border border-neutral-100 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={32} className="text-emerald-500" />
          </div>
          <p className="text-neutral-500 font-medium">Excellent! All students are currently up to date.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {defaulters.map((info) => (
            <div key={info.student.id} className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
              <div className="p-8 flex-1">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center text-white font-bold">
                    {info.student.name ? info.student.name[0] : (info.student.phone?.slice(-2) || "S")}
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900">{info.student.name || info.student.phone || "Student"}</h3>
                    <p className="text-xs text-neutral-400">{info.student.phone}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {info.missedTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center">
                        <AlertCircle size={12} className="mr-1" /> Missed Submissions ({info.missedTasks.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {info.missedTasks.map(t => (
                          <span key={t} className="text-xs font-medium bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {info.lateTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center">
                        <Clock size={12} className="mr-1" /> Late Submissions ({info.lateTasks.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {info.lateTasks.map(t => (
                          <span key={t} className="text-xs font-medium bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-100">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-neutral-50 p-8 flex flex-col justify-center items-center md:border-l border-neutral-100 space-y-4 min-w-[200px]">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-center">Admin Action</p>
                <button
                  onClick={() => handleRemoveStudent(info.student.id)}
                  disabled={removingId === info.student.id}
                  className="w-full bg-red-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  <span>{removingId === info.student.id ? "Removing..." : "Remove Student"}</span>
                </button>
                <p className="text-[10px] text-neutral-400 text-center">Will revoke all access immediately</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
