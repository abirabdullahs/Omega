'use client';

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  ChevronRight,
  ChevronDown,
  Zap,
  History,
  Sparkles,
} from "lucide-react";
import { getChapterName } from "@/lib/subjects";
import { formatDate } from "@/lib/utils";
import CurrentTopicCard from "@/components/current-topic-card";
import { Loader } from "@/components/ui/loader";

interface Task {
  id: string;
  title: string;
  contentMarkdown: string;
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

function getTimestampMilliseconds(timestamp: any): number {
  if (!timestamp) return 0;

  if (typeof timestamp?.toMillis === "function") {
    return timestamp.toMillis();
  }

  if (timestamp?.seconds) {
    return timestamp.seconds * 1000;
  }

  return new Date(timestamp).getTime();
}

function padTime(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Countdown updates only in the browser every second.
 * It does NOT fetch anything from Firestore.
 */
function TaskCountdown({ deadline }: { deadline: any }) {
  const [timeText, setTimeText] = useState("00 : 00 : 00");
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const targetTime = getTimestampMilliseconds(deadline);

    const updateCountdown = () => {
      const difference = targetTime - Date.now();

      if (difference <= 0) {
        setTimeText("00 : 00 : 00");
        setIsExpired(true);
        setIsUrgent(false);
        return;
      }

      setIsExpired(false);

      // Total hours keeps the format consistent even after 24 hours.
      const totalHours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor(
        (difference % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeText(
        `${padTime(totalHours)} : ${padTime(minutes)} : ${padTime(seconds)}`
      );

      // Orange when less than 24 hours remain.
      setIsUrgent(difference <= 24 * 60 * 60 * 1000);
    };

    updateCountdown();

    // Only local JavaScript timer; no Firestore call here.
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(intervalId);
  }, [deadline]);

  const colorClass = isExpired
    ? "border-rose-200 bg-rose-50 text-rose-600"
    : isUrgent
      ? "border-orange-200 bg-orange-50 text-orange-600"
      : "border-violet-100 bg-violet-50 text-violet-700";

  const iconBgClass = isExpired
    ? "bg-rose-100 text-rose-600"
    : isUrgent
      ? "bg-orange-100 text-orange-600"
      : "bg-violet-100 text-violet-600";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${colorClass}`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-lg ${iconBgClass}`}
      >
        <Clock size={13} strokeWidth={2.5} />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[12px] font-black tracking-tight tabular-nums sm:text-[13px]">
          {timeText}
        </span>

        <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] opacity-75">
          {isExpired ? "Expired" : "Left"}
        </span>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>(
    {}
  );
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [topicProgress, setTopicProgress] = useState<Record<string, { submitted: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { user, userData } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Firestore data is fetched once when user changes / page loads.
        const assignQ = query(
          collection(db, "assignments"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const assignSnap = await getDocs(assignQ);

        const assignList = assignSnap.docs.map(
          (assignmentDoc) =>
            ({
              id: assignmentDoc.id,
              ...assignmentDoc.data(),
            }) as Assignment
        );

        const tasksQuery = query(
          collection(db, "tasks"),
          orderBy("createdAt", "desc")
        );

        const tasksSnap = await getDocs(tasksQuery);

        const taskList = tasksSnap.docs.map(
          (taskDoc) =>
            ({
              id: taskDoc.id,
              ...taskDoc.data(),
            }) as Task
        );

        // Submission documents are loaded once.
        const submissionEntries = await Promise.all(
          taskList.map(async (task) => {
            const submissionDoc = await getDoc(
              doc(db, "submissions", task.id, "entries", user.uid)
            );

            return {
              taskId: task.id,
              submission: submissionDoc.exists()
                ? (submissionDoc.data() as Submission)
                : null,
            };
          })
        );

        const submissionData: Record<string, Submission> = {};

        submissionEntries.forEach(({ taskId, submission }) => {
          if (submission) {
            submissionData[taskId] = submission;
          }
        });

        setAssignments(assignList);
        setTasks(taskList);
        setSubmissions(submissionData);

        // Per-chapter topic progress (submitted / total), for the progress
        // bars on each running chapter card.
        try {
          const token = await user.getIdToken();
          const topicsRes = await fetch("/api/topics", { headers: { Authorization: `Bearer ${token}` } });
          const topicsData = await topicsRes.json().catch(() => null);
          if (topicsRes.ok && Array.isArray(topicsData?.items)) {
            const progress: Record<string, { submitted: number; total: number }> = {};
            topicsData.items.forEach((t: any) => {
              if (!progress[t.chapterId]) progress[t.chapterId] = { submitted: 0, total: 0 };
              progress[t.chapterId].total += 1;
              if (t.status === "submitted") progress[t.chapterId].submitted += 1;
            });
            setTopicProgress(progress);
          }
        } catch (topicErr) {
          console.error("Failed to fetch topic progress:", topicErr);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const runningAssignment = assignments.find(
    (assignment) => assignment.status === "running"
  );

  const pastAssignments = assignments.filter(
    (assignment) => assignment.status === "completed"
  );

  const runningItems = runningAssignment
    ? getAssignmentItems(runningAssignment)
    : [];

  // Dashboard only surfaces tasks that still need action — anything
  // already submitted lives in "My Submissions" instead.
  const activeTasks = tasks.filter((task) => !submissions[task.id]);

  const firstName = (userData?.name || "").trim().split(/\s+/)[0] || null;

  if (loading) {
    return (
      <div className="py-20">
        <Loader label="Loading your dashboard…" className="text-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* 0. Welcome header + quick stats */}
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Here&apos;s where things stand today.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-2xl font-bold text-neutral-900">{activeTasks.length}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 mt-0.5">Active tasks</p>
          </div>
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <p className="text-2xl font-bold text-neutral-900">{runningItems.length}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 mt-0.5">Running chapters</p>
          </div>
          <div className="rounded-2xl border border-neutral-100 bg-white p-4">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 mt-1">Today&apos;s topic below</p>
          </div>
        </div>
      </section>

      {/* 1. Active Tasks Section — only what still needs action; completed
          tasks live in My Submissions instead of cluttering the dashboard. */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-neutral-900">Active Tasks</h2>
          </div>

          <span className="text-sm text-neutral-500">
            Tap a task for details and submission status.
          </span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-dashed border-neutral-200 bg-white p-6 text-center sm:p-10">
            <p className="font-medium text-neutral-500">You&apos;re all caught up — no active tasks right now.</p>
            <Link href="/student/submissions" className="inline-block text-sm font-bold text-neutral-900 underline">
              View past submissions →
            </Link>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-3">
          {(showAllTasks ? activeTasks : activeTasks.slice(0, 5)).map((task) => {
            return (
              <Link
                key={task.id}
                href={`/student/tasks/${task.id}`}
                className="group relative overflow-hidden rounded-3xl border border-neutral-100 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-xl hover:shadow-violet-500/5"
              >
                {/* Small left accent on hover */}
                <div className="absolute inset-y-0 left-0 w-1 bg-violet-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Top row: Countdown on the top-left */}
                <div className="mb-4 flex items-center justify-between gap-4">
                  {task.deadline ? (
                    <TaskCountdown deadline={task.deadline} />
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">No deadline</span>
                  )}

                  <ChevronRight
                    size={20}
                    className="text-neutral-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-violet-600"
                  />
                </div>

                {/* Main Task Details */}
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-105">
                    <BookOpen size={23} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-bold leading-tight text-neutral-900 transition-colors group-hover:text-violet-700">
                        {task.title}
                      </h3>

                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600">
                        Open
                      </span>
                    </div>

                    {task.contentMarkdown && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                        {task.contentMarkdown.replace(/[#*`>]/g, "")}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {activeTasks.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllTasks((value) => !value)}
              className="w-full rounded-2xl border border-neutral-100 bg-white py-4 text-center text-sm font-bold text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              {showAllTasks ? "Show fewer tasks" : "View all tasks"}
            </button>
          )}
        </div>
        )}
      </section>

      {/* 1.5 Today's Topic (smart rotation) */}
      <CurrentTopicCard />

      {/* 2. Running Chapters Section */}
      <section className="mt-8 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 fill-amber-500 text-amber-500" />
            <h2 className="text-xl font-bold text-neutral-900">
              Current Assignments
            </h2>
          </div>

          <p className="text-sm text-neutral-500">
            Track your current focus and due chapters.
          </p>
        </div>

        {runningAssignment && runningItems.length > 0 ? (
          <div className="relative overflow-hidden rounded-3xl bg-neutral-900 p-6 text-white shadow-xl sm:p-8">
            <div className="relative z-10 space-y-6">
              <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    Your Running Goal
                  </p>

                  <h3 className="text-2xl font-bold">
                    This Week&apos;s Focus
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {runningItems.map((item) => {
                  const progress = topicProgress[item.chapterId];
                  const pct = progress && progress.total > 0 ? Math.round((progress.submitted / progress.total) * 100) : 0;
                  return (
                  <div
                    key={item.chapterId}
                    className="rounded-2xl border border-white/5 bg-white/5 p-4"
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase text-neutral-500">
                      {item.subjectName || item.subjectId || "Subject"}
                    </p>

                    <p className="text-sm font-medium">
                      {getChapterName(item.chapterId)}
                    </p>

                    <p className="mt-2 flex items-center text-[10px] font-bold text-amber-400">
                      <Clock size={10} className="mr-1" />
                      Due{" "}
                      {formatDate(item.deadline, {
                        day: "numeric",
                        month: "short",
                      }) || "—"}
                    </p>

                    {progress && progress.total > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                          <span>{progress.submitted}/{progress.total} topics</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl border border-dashed border-neutral-200 bg-white p-6 text-center sm:p-10">
            <p className="font-medium text-neutral-500">
              No running chapters assigned.
            </p>

            <Link
              href="/student/plan"
              className="inline-block text-sm font-bold text-neutral-900 underline"
            >
              Request new chapters →
            </Link>
          </div>
        )}
      </section>

      {/* 3. History Section */}
      {pastAssignments.length > 0 && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-neutral-400" />
              <h2 className="text-xl font-bold text-neutral-900">
                Completed Chapters
              </h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
                {pastAssignments.length}
              </span>
            </span>
            <ChevronDown
              size={18}
              className={`text-neutral-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
            />
          </button>

          {showHistory && (
          <div className="space-y-3">
            {pastAssignments.map((pastAssignment) => (
              <div
                key={pastAssignment.id}
                className="rounded-2xl border border-neutral-100 bg-white p-4 opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold text-neutral-500">
                    Cycle ended {formatDate(pastAssignment.deadline)}
                  </p>

                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-400">
                    Archive
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getAssignmentItems(pastAssignment).map((item) => (
                    <span
                      key={item.chapterId}
                      className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1 text-[10px] font-medium text-neutral-600"
                    >
                      {getChapterName(item.chapterId)}
                      {item.deadline
                        ? ` · ${formatDate(item.deadline)}`
                        : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
      )}
    </div>
  );
}
