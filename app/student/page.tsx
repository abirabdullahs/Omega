'use client';

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, getDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, ChevronRight, Zap, History, Timer } from "lucide-react";
import { getChapterName } from "@/lib/subjects";
import { formatDate } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  contentMarkdown: string; // Added to fetch the description
  createdAt: any;
  deadline?: any;
}

interface Submission {
  taskId: string;
  grade?: string;
  submittedAt: any;
}

interface AssignmentItem {
  chapterId: string;
  subjectId?: string;
  subjectName?: string;
  deadline: any;
}

interface Assignment {
  id: string;
  chapters?: Record<string, string> | AssignmentItem[];
  items?: AssignmentItem[];
  deadline: any;
  status: "running" | "completed";
  createdAt: any;
}

function getAssignmentItems(assignment: Assignment): AssignmentItem[] {
  if (Array.isArray(assignment.items) && assignment.items.length > 0) {
    return assignment.items;
  }
  if (Array.isArray(assignment.chapters)) {
    return assignment.chapters as AssignmentItem[];
  }
  if (assignment.chapters && typeof assignment.chapters === "object") {
    return Object.entries(assignment.chapters).map(([subjectId, chapterId]) => ({
      subjectId,
      chapterId,
      deadline: assignment.deadline,
    }));
  }
  return [];
}

// Sub-component for Live Countdown
function CountdownTimer({ deadline }: { deadline: any }) {
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    // Convert Firestore Timestamp to milliseconds safely
    const targetTime = deadline?.toMillis 
      ? deadline.toMillis() 
      : (deadline?.seconds * 1000 || new Date(deadline).getTime());

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("Time's up");
        setIsExpired(true);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);

      let timeString = "";
      if (d > 0) timeString += `${d}d `;
      if (h > 0 || d > 0) timeString += `${h}h `;
      timeString += `${m}m left`;

      setTimeLeft(timeString);
    };

    updateTimer(); // Initial call
    const intervalId = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(intervalId);
  }, [deadline]);

  if (!deadline) return null;

  return (
    <span className={`text-[10px] font-bold flex items-center px-2 py-1 rounded-md ${isExpired ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"}`}>
      <Timer size={12} className="mr-1" />
      {timeLeft}
    </span>
  );
}

export default function StudentDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch Assignments
        const assignQ = query(
          collection(db, "assignments"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const assignSnap = await getDocs(assignQ);
        const assignList = assignSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
        setAssignments(assignList);

        // Fetch Tasks
        const tasksSnap = await getDocs(query(collection(db, "tasks"), orderBy("createdAt", "desc")));
        const taskList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(taskList);

        // Fetch submissions
        const submissionData: Record<string, Submission> = {};
        for (const task of taskList) {
          const subDoc = await getDoc(doc(db, "submissions", task.id, "entries", user.uid));
          if (subDoc.exists()) {
            submissionData[task.id] = subDoc.data() as Submission;
          }
        }
        setSubmissions(submissionData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const runningAssignment = assignments.find(a => a.status === "running");
  const pastAssignments = assignments.filter(a => a.status === "completed");
  const runningItems = runningAssignment ? getAssignmentItems(runningAssignment) : [];

  if (loading) return (
    <div className="py-20 text-center text-neutral-400">Loading your dashboard...</div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Running Chapters Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500 fill-amber-500 w-5 h-5" />
            <h2 className="text-xl font-bold text-neutral-900">Current Assignments</h2>
          </div>
          <p className="text-sm text-neutral-500">Track your current focus and due chapters.</p>
        </div>

        {runningAssignment && runningItems.length > 0 ? (
          <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-2">
                <div>
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest mb-1">Your Running Goal</p>
                  <h3 className="text-2xl font-bold">This Week&apos;s Focus</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {runningItems.map((item) => (
                  <div key={item.chapterId} className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">
                      {item.subjectName || item.subjectId || "Subject"}
                    </p>
                    <p className="text-sm font-medium">{getChapterName(item.chapterId)}</p>
                    <p className="text-[10px] font-bold text-amber-400 mt-2 flex items-center">
                      <Clock size={10} className="mr-1" />
                      Due {formatDate(item.deadline, { day: "numeric", month: "short" }) || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
          </div>
        ) : (
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-dashed border-neutral-200 text-center space-y-3">
            <p className="text-neutral-500 font-medium">No running chapters assigned.</p>
            <Link href="/student/plan" className="inline-block text-sm font-bold text-neutral-900 underline">
              Request new chapters →
            </Link>
          </div>
        )}
      </section>

      {/* Tasks Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-500 w-5 h-5" />
            <h2 className="text-xl font-bold text-neutral-900">Module Tasks</h2>
          </div>
          <span className="text-sm text-neutral-500">Tap a task for details and submission status.</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {(showAllTasks ? tasks : tasks.slice(0, 5)).map((task) => {
            const submission = submissions[task.id];
            const isDone = !!submission;
            return (
              <Link 
                key={task.id} 
                href={`/student/tasks/${task.id}`}
                className="bg-white p-5 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between group"
              >
                <div className="flex flex-1 items-start space-x-4 mb-3 sm:mb-0 mr-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 mt-1 ${isDone ? "bg-emerald-50 text-emerald-600" : "bg-neutral-50 text-neutral-400"}`}>
                    {isDone ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                  </div>
                  <div className="flex-1 w-full">
                    <h3 className="text-base font-bold text-neutral-900 leading-tight">{task.title}</h3>
                    
                    {/* Short Description (2 Lines Max) */}
                    {task.contentMarkdown && (
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-1.5 mb-2 leading-relaxed">
                        {task.contentMarkdown.replace(/[#*`>]/g, "")}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {isDone && submission.grade ? (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Grade: {submission.grade}</span>
                      ) : isDone ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Submitted</span>
                      ) : (
                        task.deadline && <CountdownTimer deadline={task.deadline} />
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-neutral-300 group-hover:text-neutral-900 transition-all flex-shrink-0" />
              </Link>
            );
          })}
          
          {tasks.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllTasks((v) => !v)}
              className="text-xs font-bold text-neutral-400 py-3 hover:text-neutral-900 transition-colors text-center w-full bg-neutral-50 hover:bg-neutral-100 rounded-xl"
            >
              {showAllTasks ? "Show fewer tasks" : "View all tasks"}
            </button>
          )}
        </div>
      </section>

      {/* History Section */}
      {pastAssignments.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="text-neutral-400 w-5 h-5" />
            <h2 className="text-xl font-bold text-neutral-900">Completed Chapters</h2>
          </div>
          <div className="space-y-3">
            {pastAssignments.map((pa) => (
              <div key={pa.id} className="bg-white p-4 rounded-2xl border border-neutral-100 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-3">
                  <p className="text-xs font-bold text-neutral-500">Cycle ended {formatDate(pa.deadline)}</p>
                  <span className="text-[10px] font-bold bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-md uppercase">Archive</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getAssignmentItems(pa).map((item) => (
                    <span key={item.chapterId} className="text-[10px] font-medium bg-neutral-50 text-neutral-600 px-2 py-1 rounded-lg border border-neutral-100">
                      {getChapterName(item.chapterId)}
                      {item.deadline ? ` · ${formatDate(item.deadline)}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
