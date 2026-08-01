'use client';

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { Plus, Clock, Play, StopCircle, X, Pencil, Check } from "lucide-react";

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
  zoomMeetingInternalId?: string;
  zoomMeetingUuid?: string;
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

function getCountdownText(session: LiveSession) {
  const now = Date.now();
  const startAt = toDate(session.startAt)?.getTime() ?? 0;
  const durationMs = Number(session.durationMinutes || 0) * 60 * 1000;
  const endAt = startAt + durationMs;

  if (session.status === "cancelled") return "Session cancelled";
  if (session.status === "ended" || now >= endAt) return "Session ended";
  if (now >= startAt) {
    const left = Math.max(0, endAt - now);
    const minutes = Math.floor(left / 60000);
    const seconds = Math.floor((left % 60000) / 1000);
    return `Live · ${minutes}m ${seconds}s remaining`;
  }

  const left = Math.max(0, startAt - now);
  const days = Math.floor(left / (1000 * 60 * 60 * 24));
  const hours = Math.floor((left % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${hours}h ${minutes}m until start`;
}

export default function AdminLiveSessionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [form, setForm] = useState({
    title: "",
    topic: "",
    startAt: "",
    durationMinutes: 60,
    joinWindowMinutes: 0,
    zoomMeetingId: "",
    zoomMeetingPassword: "",
    zoomJoinUrl: "",
  });

  const fetchSessions = async () => {
    if (!user) return;
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
    fetchSessions();
  }, [user?.uid]);

  const resetForm = () => {
    setEditingSession(null);
    setForm({
      title: "",
      topic: "",
      startAt: "",
      durationMinutes: 60,
      joinWindowMinutes: 0,
      zoomMeetingId: "",
      zoomMeetingPassword: "",
      zoomJoinUrl: "",
    });
  };

  const openEdit = (session: LiveSession) => {
    setEditingSession(session);
    setShowCreate(true);
    setForm({
      title: session.title,
      topic: session.topic,
      startAt: toDate(session.startAt)?.toISOString().slice(0, 16) || "",
      durationMinutes: Number(session.durationMinutes || 60),
      joinWindowMinutes: Number(session.joinWindowMinutes || 0),
      zoomMeetingId: session.zoomMeetingId || "",
      zoomMeetingPassword: session.zoomMeetingPassword || "",
      zoomJoinUrl: session.zoomJoinUrl || "",
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const payload: any = {
      title: form.title,
      topic: form.topic,
      startAt: new Date(form.startAt).toISOString(),
      durationMinutes: Number(form.durationMinutes),
      joinWindowMinutes: Number(form.joinWindowMinutes),
      zoomMeetingId: form.zoomMeetingId || null,
      zoomMeetingPassword: form.zoomMeetingPassword || null,
      zoomJoinUrl: form.zoomJoinUrl || null,
    };

    try {
      const token = await user.getIdToken();
      const url = editingSession
        ? `/api/admin/live-sessions/${encodeURIComponent(editingSession.id)}`
        : "/api/admin/live-sessions";
      const method = editingSession ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save live session.");
      }
      toast.success(editingSession ? "Live session updated." : "Live session created.");
      resetForm();
      setShowCreate(false);
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to save live session.");
    }
  };

  const handleAction = async (sessionId: string, action: string) => {
    if (!user) return;
    const confirmLabel =
      action === "cancel"
        ? "Cancel this session?"
        : action === "end"
        ? "Mark this session as ended?"
        : action === "start"
        ? "Mark this session as live?"
        : "Apply action?";
    if (!window.confirm(confirmLabel)) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/live-sessions/${encodeURIComponent(sessionId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update session status.");
      }
      toast.success(`Session ${action}ed.`);
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to update session.");
    }
  };

  const sessionCount = sessions.length;
  const upcomingCount = sessions.filter((session) => getSessionStatus(session) === "Upcoming").length;
  const liveCount = sessions.filter((session) => getSessionStatus(session) === "Live").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Live Sessions</h2>
          <p className="text-neutral-500">Create, manage, and monitor Zoom-powered live classes from the admin portal.</p>
        </div>
        <button
          onClick={() => {
            setShowCreate((value) => !value);
            if (showCreate) resetForm();
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {showCreate ? "Close Form" : "New Live Session"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Total sessions</p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">{sessionCount}</p>
        </div>
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Upcoming</p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">{upcomingCount}</p>
        </div>
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Live now</p>
          <p className="mt-3 text-3xl font-bold text-neutral-900">{liveCount}</p>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900">{editingSession ? "Edit Live Session" : "Create Live Session"}</h3>
          <form onSubmit={handleSave} className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Title</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Topic</span>
              <input
                required
                value={form.topic}
                onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-neutral-700">Start time</span>
              <input
                required
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Duration (minutes)</span>
              <input
                required
                type="number"
                min={5}
                value={form.durationMinutes}
                onChange={(e) => setForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Join window before start (minutes)</span>
              <input
                type="number"
                min={0}
                value={form.joinWindowMinutes}
                onChange={(e) => setForm((prev) => ({ ...prev, joinWindowMinutes: Number(e.target.value) }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Zoom meeting ID</span>
              <input
                value={form.zoomMeetingId}
                onChange={(e) => setForm((prev) => ({ ...prev, zoomMeetingId: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-neutral-700">Zoom meeting password</span>
              <input
                value={form.zoomMeetingPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, zoomMeetingPassword: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-neutral-700">Zoom join URL</span>
              <input
                value={form.zoomJoinUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, zoomJoinUrl: e.target.value }))}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
                className="rounded-2xl border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
              >
                <Check className="w-4 h-4" />
                Save session
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-3xl border border-neutral-100 bg-white p-8 text-center text-neutral-400">Loading live sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
            No live sessions found yet.
          </div>
        ) : (
          sessions.map((session) => {
            const status = getSessionStatus(session);
            const startAt = toDate(session.startAt);
            return (
              <div key={session.id} className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">{status}</p>
                    <h3 className="mt-2 text-xl font-semibold text-neutral-900">{session.title}</h3>
                    <p className="text-sm text-neutral-500">{session.topic}</p>
                  </div>
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    {formatDateTime(startAt)}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-neutral-50 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Duration</p>
                    <p className="mt-2 text-sm font-semibold text-neutral-900">{session.durationMinutes} minutes</p>
                  </div>
                  <div className="rounded-3xl bg-neutral-50 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-neutral-400">Join window</p>
                    <p className="mt-2 text-sm font-semibold text-neutral-900">{session.joinWindowMinutes || 0} minutes before</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-neutral-500">{getCountdownText(session)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(session)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                    {status !== "Ended" && status !== "Cancelled" ? (
                      <>
                        <button
                          onClick={() => handleAction(session.id, session.status === "live" ? "end" : "start")}
                          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                        >
                          {session.status === "live" ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {session.status === "live" ? "End" : "Start"}
                        </button>
                        <button
                          onClick={() => handleAction(session.id, "cancel")}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
