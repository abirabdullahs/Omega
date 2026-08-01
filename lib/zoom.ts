const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || "";
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || "";
const ZOOM_API_BASE_URL = process.env.ZOOM_API_BASE_URL || "https://api.zoom.us/v2";
const ZOOM_OAUTH_TOKEN_URL = process.env.ZOOM_OAUTH_TOKEN_URL || "https://zoom.us/oauth/token?grant_type=account_credentials";

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

let zoomTokenCache: ZoomTokenCache | null = null;

function getZoomClientCredentials() {
  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("Missing Zoom OAuth credentials. Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.");
  }

  const creds = `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`;
  return Buffer.from(creds).toString("base64");
}

async function fetchZoomAccessToken(): Promise<string> {
  if (zoomTokenCache && zoomTokenCache.expiresAt > Date.now() + 10_000) {
    return zoomTokenCache.accessToken;
  }

  const response = await fetch(ZOOM_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getZoomClientCredentials()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    const errorMessage = data?.message || `Zoom OAuth token endpoint responded with ${response.status}`;
    throw new Error(errorMessage);
  }

  const expiresIn = Number(data.expires_in || 3600);
  zoomTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return zoomTokenCache.accessToken;
}

async function zoomFetch(path: string, method = "GET", body?: any) {
  const url = `${ZOOM_API_BASE_URL}${path}`;
  const token = await fetchZoomAccessToken();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data?.message || `Zoom API responded with ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

export interface ZoomMeetingCreateResult {
  meetingId: string;
  internalId: string;
  uuid: string;
  joinUrl: string;
  password?: string;
}

export async function createZoomMeeting({
  topic,
  startTime,
  durationMinutes,
  password,
}: {
  topic: string;
  startTime: string;
  durationMinutes: number;
  password?: string;
}): Promise<ZoomMeetingCreateResult> {
  const payload: any = {
    topic,
    type: 2,
    start_time: startTime,
    duration: durationMinutes,
    settings: {
      host_video: false,
      participant_video: false,
      join_before_host: false,
      approval_type: 0,
      waiting_room: false,
    },
  };

  if (password) {
    payload.password = password;
  }

  const data = await zoomFetch("/users/me/meetings", "POST", payload);

  return {
    meetingId: String(data.meeting_number || data.id),
    internalId: String(data.id),
    uuid: String(data.uuid),
    joinUrl: data.join_url,
    password: data.password || password,
  };
}

export async function updateZoomMeeting(meetingInternalId: string, updates: {
  topic?: string;
  startTime?: string;
  durationMinutes?: number;
  password?: string | null;
}) {
  const payload: any = {};
  if (updates.topic !== undefined) payload.topic = updates.topic;
  if (updates.startTime !== undefined) payload.start_time = updates.startTime;
  if (updates.durationMinutes !== undefined) payload.duration = updates.durationMinutes;
  if (updates.password !== undefined) payload.password = updates.password;

  if (Object.keys(payload).length === 0) {
    return;
  }

  await zoomFetch(`/meetings/${encodeURIComponent(meetingInternalId)}`, "PATCH", payload);
}

export async function endZoomMeeting(meetingInternalId: string) {
  await zoomFetch(`/meetings/${encodeURIComponent(meetingInternalId)}/status`, "PUT", {
    action: "end",
  });
}
