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
  CheckCircle2,
  Clock,
  ChevronRight,
  Zap,
  History,
} from "lucide-react";
import { getChapterName } from "@/lib/subjects";
import { formatDate } from "@/lib/utils";

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

function CountdownTimer({
  deadline,
  createdAt,
}: {
  deadline: any;
  createdAt?: any;
}) {
  const [timeLeft, setTimeLeft] = useState("...");
  const [isExpired, setIsExpired] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urgency, setUrgency] = useState<"normal" | "soon" | "urgent">(
    "normal"
  );

  useEffect(() => {
    if (!deadline) return;

    const targetTime = deadline?.toMillis
      ? deadline.toMillis()
      : deadline?.seconds
        ? deadline.seconds * 1000
        : new Date(deadline).getTime();

    const fallbackStart = Date.now() - 86400000;

    const startTime = createdAt?.toMillis
      ? createdAt.toMillis()
      : createdAt?.seconds
        ? createdAt.seconds * 1000
        : new Date(createdAt).getTime() || fallbackStart;

    const totalDuration = Math.max(targetTime - startTime, 1);

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        setIsExpired(true);
        setProgress(100);
        return;
      }

      setIsExpired(false);

      const elapsed = Math.max(now - startTime, 0);
      const currentProgress = Math.min((elapsed / totalDuration) * 100, 100);

      setProgress(currentProgress);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
        setUrgency(days <= 1 ? "urgent" : days <= 3 ? "soon" : "normal");
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setUrgency(hours <= 6 ? "urgent" : "soon");
      } else {
        setTimeLeft(`${minutes}m`);
        setUrgency("urgent");
      }
    };

    updateTimer();

    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [deadline, createdAt]);

  if (!deadline) return null;

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const styles = isExpired
    ? {
        wrapper: "border-rose-100 bg-rose-50",
        ring: "text-rose-500",
        label: "text-rose-500",
        value: "text-rose-700",
      }
    : urgency === "urgent"
      ? {
          wrapper: "border-orange-100 bg-orange-50",
          ring: "text-orange-500",
          label: "text-orange-500",
          value: "text-orange-700",
        }
      : urgency === "soon"
        ? {
            wrapper: "border-amber-100 bg-amber-50",
            ring: "text-amber-500",
            label: "text-amber-600",
            value: "text-amber-800",
          }
        : {
            wrapper: "border-neutral-200 bg-neutral-50",
            ring: "text-blue-500",
            label: "text-neutral-400",
            value: "text-neutral-800",
          };

  return (
    <div
      className={`flex min-w-[145px] items-center gap-3 rounded-2xl border px-3 py-2.5 ${styles.wrapper}`}
    >
      <div
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center ${styles.ring}`}
      >
        <svg className="h-full w-full -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            className="opacity-15"
          />

          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        <Clock size={15} className="absolute" strokeWidth={2.5} />
      </div>

      <div className="min-w-0">
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.12em] ${styles.label}`}
        >
          {isExpired ? "Deadline passed" : "Due in"}
        </p>

        <p
          className={`mt-0.5 text-sm font-black tabular-nums tracking-tight ${styles.value}`}
        >
          {timeLeft}
        </p>
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

        setAssignments(assignList);

        const tasksSnap = await getDocs(
          query(collection(db, "tasks"), orderBy("createdAt", "desc"))
        );

        const taskList = tasksSnap.docs.map(
          (taskDoc) =>
            ({
              id: taskDoc.id,
              ...taskDoc.data(),
            }) as Task
        );

        setTasks(taskList);

        const submissionData: Record<string, Submission> = {};

        for (const task of taskList) {
          const subDoc = await getDoc(
            doc(db, "submissions", task.id, "entries", user.uid)
          );

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

  const runningAssignment = assignments.find(
    (assignment) => assignment.status === "running"
  );

  const pastAssignments = assignments.filter(
    (assignment) => assignment.status === "completed"
  );

  const runningItems = runningAssignment
    ? getAssignmentItems(runningAssignment)
    : [];

  if (loading) {
    return (
      <div className="py-20 text-center text-neutral-400">
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* 1. Tasks Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold text-neutral-900">Module Tasks</h2>
          </div>

          <span className="text-sm text-neutral-500">
            Tap a task for details and submission status.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {(showAllTasks ? tasks : tasks.slice(0, 5)).map((task) => {
            const submission = submissions[task.id];
            const isDone = !!submission;

            return (
              <Link
                key={task.id}
                href={`/student/tasks/${task.id}`}
                className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-neutral-100 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 md:flex-row md:items-center md:gap-6"
              >
                {/* Left blue line on hover */}
                <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Left Side: Task Details */}
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${
                      isDone
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={23} />
                    ) : (
                      <BookOpen size={23} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[17px] font-bold leading-tight text-neutral-900 transition-colors group-hover:text-blue-600">
                        {task.title}
                      </h3>

                      {!isDone && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                          Open
                        </span>
                      )}
                    </div>

                    {task.contentMarkdown && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                        {task.contentMarkdown.replace(/[#*`>]/g, "")}
                      </p>
                    )}

                    {isDone && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 size={12} />
                          {submission.grade
                            ? `Grade: ${submission.grade}`
                            : "Submitted"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Countdown */}
                <div className="ml-16 flex items-center justify-between gap-4 md:ml-0 md:justify-end">
                  {!isDone && task.deadline && (
                    <CountdownTimer
                      deadline={task.deadline}
                      createdAt={task.createdAt}
                    />
                  )}

                  <ChevronRight
                    size={20}
                    className="hidden text-neutral-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-neutral-900 md:block"
                  />
                </div>
              </Link>
            );
          })}

          {tasks.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllTasks((value) => !value)}
              className="w-full rounded-2xl border border-neutral-100 bg-white py-4 text-center text-sm font-bold text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
            >
              {showAllTasks ? "Show fewer tasks" : "View all tasks"}
            </button>
          )}
        </div>
      </section>

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
                {runningItems.map((item) => (
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
                  </div>
                ))}
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
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-neutral-400" />
            <h2 className="text-xl font-bold text-neutral-900">
              Completed Chapters
            </h2>
          </div>

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
        </section>
      )}
    </div>
  );
}
