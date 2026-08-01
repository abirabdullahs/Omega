'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { Clock, Play, ArrowRight, CalendarDays } from "lucide-react";

interface LiveSession {
  id: string;
  title: string;
  topic: string;
  startAt: any;
  durationMinutes: number;
  joinWindowMinutes?: number;
  status?: string;
  zoomMeetingId?: string;
  zoomMeetingPassword?: string;
  zoomJoinUrl?: string;
}

function toDate(value: any) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return null;
}

function getSessionStatus(session: LiveSession) {
  const now = Date.now();
  const startAt = toDate(session.startAt)?.getTime() ?? 0;
  const durationMs = Number(session.durationMinutes || 0) * 60 * 1000;
  const endAt = startAt + durationMs;

  if (session.status === "cancelled") return "Cancelled";
  if (session.status === "ended" || now >= endAt) return "Ended";
  if (session.status === "live" || now >= startAt) return "Live";
  return "Upcoming";
}

function getCountdown(session: LiveSession) {
  const now = Date.now();
  const startAt = toDate(session.startAt)?.getTime() ?? 0;
  const durationMs = Number(session.durationMinutes || 0) * 60 * 1000;
  const endAt = startAt + durationMs;

  if (session.status === "cancelled") return "Cancelled";
  if (session.status === "ended" || now >= endAt) return "Session ended";
  if (now >= startAt) {
    const remaining = Math.max(0, endAt - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `Live · ${minutes}m ${seconds}s remaining`;
  }
  const left = Math.max(0, startAt - now);
  const days = Math.floor(left / (1000 * 60 * 60 * 24));
  const hours = Math.floor((left % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${hours}h ${minutes}m until start`;
}

export default function StudentLiveSessionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/live-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load live sessions.");
      }
      setSessions((data.items || []).map((item: any) => ({ id: item.id, ...item })));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to load live sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSessions();
    const interval = window.setInterval(fetchSessions, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [user]);

  const nearestSession = useMemo(() => {
    const valid = sessions
      .filter((session) => getSessionStatus(session) !== "Cancelled")
      .sort((a, b) => (toDate(a.startAt)?.getTime() || 0) - (toDate(b.startAt)?.getTime() || 0));
    return valid[0] || null;
  }, [sessions]);

  const handleJoin = async (session: LiveSession) => {
    if (!user) return;
    setActiveSessionId(session.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/live-sessions/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to join live session.");
      }
      window.open(data.meetingUrl, "_blank");
      toast.success("Joining live session...");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to join the session.");
    } finally {
      setActiveSessionId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Live Sessions</h2>
            <p className="text-neutral-500">View upcoming classes and join live Zoom sessions directly.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/student"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Available sessions</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900">{sessions.length}</p>
          </div>
          <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Next session</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900">{nearestSession ? formatDateTime(toDate(nearestSession.startAt)) : "None"}</p>
          </div>
          <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Live now</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900">{sessions.filter((session) => getSessionStatus(session) === "Live").length}</p>
          </div>
          <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-neutral-500">Upcoming</p>
            <p className="mt-3 text-3xl font-bold text-neutral-900">{sessions.filter((session) => getSessionStatus(session) === "Upcoming").length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <div className="rounded-3xl border border-neutral-100 bg-white p-10 text-center text-neutral-400">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-white p-10 text-center text-neutral-500">No live sessions have been scheduled yet.</div>
        ) : (
          sessions.map((session) => {
            const status = getSessionStatus(session);
            const startAt = toDate(session.startAt);
            const countdown = getCountdown(session);
            const now = Date.now();
            const startMs = startAt?.getTime() ?? 0;
            const durationMs = Number(session.durationMinutes || 0) * 60 * 1000;
            const endMs = startMs + durationMs;
            const joinWindowMs = Number(session.joinWindowMinutes || 0) * 60 * 1000;
            const earliestJoinMs = startMs - joinWindowMs;
            const canJoin = status === "Live" || (now >= earliestJoinMs && now < endMs && status !== "Cancelled" && status !== "Ended");

            return (
              <div key={session.id} className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">{status}</p>
                    <h3 className="mt-2 text-xl font-semibold text-neutral-900">{session.title}</h3>
                    <p className="mt-2 text-sm text-neutral-500">{session.topic}</p>
                  </div>
                  <div className="rounded-3xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      {formatDateTime(startAt)}
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">{session.durationMinutes} min</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-3xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {countdown}
                    </div>
                  </div>
                  <button
                    disabled={!canJoin || activeSessionId === session.id}
                    onClick={() => handleJoin(session)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                      canJoin
                        ? "bg-neutral-900 text-white hover:bg-neutral-800"
                        : "cursor-not-allowed bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    {status === "Live" ? "Join now" : canJoin ? "Join session" : status === "Ended" ? "Session ended" : status === "Cancelled" ? "Cancelled" : "Join unavailable"}
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-neutral-100 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                  <p>
                    Zoom meeting ID: <span className="font-mono text-neutral-900">{session.zoomMeetingId || "N/A"}</span>
                  </p>
                  {session.zoomMeetingPassword ? (
                    <p className="mt-1">
                      Password: <span className="font-mono text-neutral-900">{session.zoomMeetingPassword}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
