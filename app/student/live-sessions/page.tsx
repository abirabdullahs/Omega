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
  const { user, userData } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [meetingConfig, setMeetingConfig] = useState<ZoomSdkMeetingConfig | null>(null);
  const [sdkLoading, setSdkLoading] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

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
        const module = await import("@zoomus/websdk/embedded");
        const ZoomMtgEmbedded = (module as any).default || module;
        client = ZoomMtgEmbedded.createClient();

        const meetingRoot = document.getElementById("zoomSDKElement");
        if (!meetingRoot) throw new Error("Unable to find Zoom meeting root container.");

        client.init({
          zoomAppRoot: meetingRoot,
          language: "en-US",
          leaveUrl: `${window.location.origin}/student/live-sessions`,
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
          userName: userData?.name || user?.displayName || "Student",
          userEmail: user?.email || "",
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

        if (isActive) {
          setSdkLoading(false);
        }
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
  }, [meetingConfig, user, userData]);

  const nearestSession = useMemo(() => {
    const valid = sessions
      .filter((session) => getSessionStatus(session) !== "Cancelled")
      .sort((a, b) => (toDate(a.startAt)?.getTime() || 0) - (toDate(b.startAt)?.getTime() || 0));
    return valid[0] || null;
  }, [sessions]);

  const handleJoin = async (session: LiveSession) => {
    if (!user) return;
    setActiveSessionId(session.id);
    setSdkError(null);
    setMeetingConfig(null);
    setSdkLoading(true);

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

      if (data.meetingNumber && data.signature && data.sdkKey) {
        setMeetingConfig({
          meetingNumber: data.meetingNumber,
          password: data.password || "",
          sdkKey: data.sdkKey,
          signature: data.signature,
          topic: data.topic || session.title || session.topic || "Live session",
        });
        toast.success("Joining live session in the browser...");
      } else if (data.meetingUrl) {
        window.open(data.meetingUrl, "_blank");
        toast.success("Joining live session...");
      } else {
        throw new Error("Meeting details are not available.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unable to join the session.");
      setSdkLoading(false);
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

      {meetingConfig ? (
        <div className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-neutral-500">Zoom in-browser session</p>
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
