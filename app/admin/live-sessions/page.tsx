'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { formatDateTime } from "@/lib/utils";
import { Plus, Clock, Play, ArrowRight, StopCircle, X, Pencil, Check, Trash2 } from "lucide-react";

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

interface ZoomSdkMeetingConfig {
  meetingNumber: string;
  password: string;
  sdkKey: string;
  signature: string;
  topic: string;
}

const ZOOM_SDK_VERSION = "2.18.3";

function toDate(value: any) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
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

function getMeetingUrl(session: LiveSession) {
  if (session.zoomJoinUrl) return String(session.zoomJoinUrl).trim();
  if (session.zoomMeetingId) return `https://zoom.us/j/${encodeURIComponent(String(session.zoomMeetingId).trim())}`;
  return null;
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [meetingConfig, setMeetingConfig] = useState<ZoomSdkMeetingConfig | null>(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
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

  const fetchSessions = useCallback(async () => {
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
  }, [toast, user]);

  useEffect(() => {
    const load = async () => {
      await fetchSessions();
    };
    load();
  }, [fetchSessions]);

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

  const handleHost = async (session: LiveSession) => {
    if (!user) return;
    setActiveSessionId(session.id);
    setSdkError(null);
    setSdkLoading(true);
    setMeetingConfig(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/live-sessions/join", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to prepare host meeting.");
      }

      if (data.meetingNumber && data.signature && data.sdkKey) {
        setMeetingConfig({
          meetingNumber: data.meetingNumber,
          password: data.password || "",
          sdkKey: data.sdkKey,
          signature: data.signature,
          topic: data.topic || session.title || session.topic || "Live session",
        });
        toast.success("Opening host meeting in browser...");
      } else if (data.meetingUrl) {
        window.open(data.meetingUrl, "_blank");
        toast.success("Opening meeting link...");
      } else {
        throw new Error("Host meeting details are not available.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to open host meeting.");
      setSdkLoading(false);
      setActiveSessionId(null);
    }
  };

  useEffect(() => {
    if (!meetingConfig || !user) return;

    let client: any;
    let isActive = true;

    const loadZoomStyles = () => {
      const root = document.head;
      const baseUrl = `https://source.zoom.us/${ZOOM_SDK_VERSION}`;
      const existingBootstrap = root.querySelector('link[data-zoom-sdk="bootstrap"]');
      const existingReactSelect = root.querySelector('link[data-zoom-sdk="react-select"]');

      if (!existingBootstrap) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${baseUrl}/css/bootstrap.css`;
        link.dataset.zoomSdk = "bootstrap";
        root.appendChild(link);
      }

      if (!existingReactSelect) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${baseUrl}/css/react-select.css`;
        link.dataset.zoomSdk = "react-select";
        root.appendChild(link);
      }
    };

    const joinLiveSession = async () => {
      setSdkError(null);
      setSdkLoading(true);

      try {
        loadZoomStyles();
        const zoomSdk = await import("@zoomus/websdk/embedded");
        const ZoomMtgEmbedded = (zoomSdk as any).default || zoomSdk;
        client = ZoomMtgEmbedded.createClient();

        const meetingRoot = document.getElementById("zoomSDKElement");
        if (!meetingRoot) throw new Error("Unable to find Zoom meeting root container.");

        client.init({
          zoomAppRoot: meetingRoot,
          language: "en-US",
          leaveUrl: `${window.location.origin}/admin/live-sessions`,
          disableInvite: true,
          disableCallOut: true,
          disableRecord: true,
          disableJoinAudio: false,
          showMeetingHeader: true,
          isSupportAV: true,
          success: () => {
            if (!isActive) return;
            setSdkLoading(false);
          },
          error: (error: any) => {
            if (!isActive) return;
            console.error("Zoom SDK init failed", error);
            setSdkError(String(error));
            setSdkLoading(false);
          },
        });

        client.join({
          sdkKey: meetingConfig.sdkKey,
          signature: meetingConfig.signature,
          meetingNumber: meetingConfig.meetingNumber,
          password: meetingConfig.password || "",
          userName: user.displayName || user.email || "Host",
          userEmail: user.email || "",
          success: () => {
            if (!isActive) return;
            setSdkLoading(false);
          },
          error: (error: any) => {
            if (!isActive) return;
            console.error("Zoom SDK join failed", error);
            setSdkError(String(error));
            setSdkLoading(false);
          },
        });
      } catch (err: any) {
        console.error("Zoom SDK error", err);
        if (isActive) {
          setSdkError(err?.message || "Unable to start Zoom meeting.");
          setSdkLoading(false);
        }
      }
    };

    joinLiveSession();

    return () => {
      isActive = false;
      if (client?.leaveMeeting) {
        try {
          client.leaveMeeting();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [meetingConfig, user]);

  useEffect(() => {
    if (!showCreate) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [showCreate]);

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
      if (data.zoomWarning) {
        toast.error(`Heads up: ${data.zoomWarning}`);
      }
      resetForm();
      setShowCreate(false);
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to save live session.");
    }
  };

  const handleAction = async (session: LiveSession, action: string) => {
    if (!user) return;
    const sessionId = session.id;
    const confirmLabel =
      action === "cancel"
        ? "Cancel this session?"
        : action === "end"
        ? "Mark this session as ended?"
        : action === "start"
        ? "Mark this session as live and open the Zoom meeting?"
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
      if (action === "start") {
        const meetingUrl = getMeetingUrl(session);
        if (meetingUrl) {
          window.open(meetingUrl, "_blank", "noopener,noreferrer");
        } else {
          toast.error("No Zoom link is attached to this session yet — click Edit to add one.");
        }
      }
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to update session.");
    }
  };

  const handleDelete = async (session: LiveSession) => {
    if (!user) return;
    if (!window.confirm(`Permanently delete "${session.title}"? This also removes its attendance records and cannot be undone.`)) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/live-sessions/${encodeURIComponent(session.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete session.");
      }
      toast.success("Live session deleted.");
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to delete session.");
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
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm();
              setShowCreate(false);
            }
          }}
        >
          <div className="w-full max-w-2xl my-8 sm:my-0 rounded-3xl border border-neutral-100 bg-white p-6 sm:p-8 shadow-xl max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-neutral-900">{editingSession ? "Edit Live Session" : "Create Live Session"}</h3>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
                aria-label="Close"
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-2">
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
        </div>
      )}

      {meetingConfig ? (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-500">Zoom host session</p>
              <h3 className="mt-1 text-xl font-semibold text-neutral-900">{meetingConfig.topic}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setMeetingConfig(null);
                setSdkError(null);
                setSdkLoading(false);
              }}
              className="inline-flex items-center rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
            >
              Leave session
            </button>
          </div>

          <div id="zoomSDKElement" className="min-h-[520px] rounded-3xl bg-black" />
          {sdkLoading ? <p className="mt-4 text-sm text-neutral-500">Loading Zoom meeting…</p> : null}
          {sdkError ? <p className="mt-4 text-sm text-red-600">{sdkError}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-3xl border border-neutral-100 bg-white p-8 text-center text-neutral-400">Loading live sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
            No live sessions found yet.
          </div>
        ) : (
          (showAllSessions ? sessions : sessions.slice(0, 4)).map((session) => {
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
                    {session.zoomMeetingId ? (
                      <button
                        onClick={() => handleHost(session)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Host in browser
                      </button>
                    ) : null}
                    {getMeetingUrl(session) ? (
                      <a
                        href={getMeetingUrl(session) || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Open meeting
                      </a>
                    ) : null}
                    {status !== "Ended" && status !== "Cancelled" ? (
                      <>
                        <button
                          onClick={() => handleAction(session, session.status === "live" ? "end" : "start")}
                          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
                        >
                          {session.status === "live" ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {session.status === "live" ? "End" : "Start"}
                        </button>
                        <button
                          onClick={() => handleAction(session, "cancel")}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    ) : null}
                    <button
                      onClick={() => handleDelete(session)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-500 hover:bg-red-50 hover:border-red-100 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && !showAllSessions && sessions.length > 4 && (
        <div className="text-center">
          <button
            onClick={() => setShowAllSessions(true)}
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
          >
            Show all {sessions.length} sessions
          </button>
        </div>
      )}
    </div>
  );
}
