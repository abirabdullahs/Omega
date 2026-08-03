'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { Sparkles, Settings2, X, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { SUBJECTS } from "@/lib/subjects";

function subjectName(subjectId: string): string {
  return SUBJECTS.find((s) => s.id === subjectId)?.name || subjectId;
}

function padTime(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function TopicCountdown({ deadlineAt }: { deadlineAt: number | null }) {
  const [timeText, setTimeText] = useState("00 : 00 : 00");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadlineAt) return;
    const update = () => {
      const diff = deadlineAt - Date.now();
      if (diff <= 0) {
        setTimeText("00 : 00 : 00");
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeText(`${padTime(hours)} : ${padTime(minutes)} : ${padTime(seconds)}`);
      setIsUrgent(diff <= 60 * 60 * 1000); // under 1 hour left
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  if (!deadlineAt) return null;

  return (
    <p className={`font-mono text-lg font-bold tracking-wider ${isExpired ? "text-red-300" : isUrgent ? "text-amber-300" : "text-white"}`}>
      {isExpired ? "Deadline passed" : timeText}
    </p>
  );
}

interface CurrentTopic {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterName: string;
  topic: { id: string; name: string; status: string };
  topicIndex: number;
  topicsInChapter: number;
}

export default function CurrentTopicCard() {
  const { user } = useAuth();
  const toast = useToast();

  const [currentTopic, setCurrentTopic] = useState<CurrentTopic | null>(null);
  const [subjectOrder, setSubjectOrder] = useState<string[]>([]);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/study-cycle", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setCurrentTopic(data.currentTopic || null);
        setSubjectOrder(data.subjectOrder || []);
        setDeadlineAt(data.deadlineAt || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  const handleSubmitTopic = async () => {
    if (!user || !currentTopic) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/topics/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setCurrentTopic(data.currentTopic || null);
        setDeadlineAt(data.deadlineAt || null);
        toast.success(
          data.lapCompleted
            ? "Topic complete! You've finished a full round — starting fresh."
            : "Topic complete! Extra time carried forward to the next one."
        );
      } else {
        toast.error(data?.error || "Failed to submit topic.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit topic.");
    } finally {
      setSubmitting(false);
    }
  };

  const openReorder = () => {
    setDraftOrder(subjectOrder);
    setShowReorder(true);
  };

  const move = (index: number, dir: -1 | 1) => {
    setDraftOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveOrder = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/study-cycle", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectOrder: draftOrder }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSubjectOrder(data.subjectOrder || draftOrder);
        setShowReorder(false);
        toast.success("Subject order updated.");
        load();
      } else {
        toast.error(data?.error || "Failed to update order.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          <h2 className="text-xl font-bold text-neutral-900">Today&apos;s Topic</h2>
        </div>
        {subjectOrder.length > 1 && (
          <button
            onClick={openReorder}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <Settings2 size={14} />
            Customize order
          </button>
        )}
      </div>

      {currentTopic ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-white shadow-xl sm:p-8">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-violet-200">
            {currentTopic.subjectName} · {currentTopic.chapterName}
          </p>
          <h3 className="text-2xl font-bold mb-1">{currentTopic.topic.name}</h3>
          <p className="text-sm text-violet-200 mb-4">
            Topic {currentTopic.topicIndex + 1} of {currentTopic.topicsInChapter}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200 mb-1">Time remaining</p>
              <TopicCountdown deadlineAt={deadlineAt} />
            </div>
            <button
              onClick={handleSubmitTopic}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-lg hover:bg-violet-50 disabled:opacity-50 transition-all"
            >
              <CheckCircle2 size={16} />
              {submitting ? "Submitting…" : "Submitted"}
            </button>
          </div>

          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-dashed border-neutral-200 bg-white p-6 text-center sm:p-10">
          <p className="font-medium text-neutral-500">No active topic yet — add topics to your assigned chapters to start.</p>
          <Link href="/student/topics" className="inline-block text-sm font-bold text-neutral-900 underline">
            Manage topics →
          </Link>
        </div>
      )}

      {showReorder && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReorder(false);
          }}
        >
          <div className="w-full max-w-sm my-8 sm:my-0 rounded-3xl border border-neutral-100 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900">Subject Order</h3>
              <button onClick={() => setShowReorder(false)} aria-label="Close" className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-4">Topics rotate through your subjects in this order.</p>
            <div className="space-y-2 mb-6">
              {draftOrder.map((subjectId, idx) => (
                <div key={subjectId} className="flex items-center justify-between gap-2 bg-neutral-50 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-medium text-neutral-800">{idx + 1}. {subjectName(subjectId)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === draftOrder.length - 1}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                    >
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={saveOrder}
              disabled={saving}
              className="w-full bg-neutral-900 text-white py-3 rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving…" : "Save order"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
