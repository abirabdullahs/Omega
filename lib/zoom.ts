import crypto from "crypto";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || "";
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || "";
const ZOOM_SDK_KEY = process.env.ZOOM_SDK_KEY || process.env.ZOOM_CLIENT_ID || "";
const ZOOM_SDK_SECRET = process.env.ZOOM_SDK_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
const ZOOM_API_BASE_URL = process.env.ZOOM_API_BASE_URL || "https://api.zoom.us/v2";
const ZOOM_OAUTH_TOKEN_URL = process.env.ZOOM_OAUTH_TOKEN_URL || "https://zoom.us/oauth/token";
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI || "";
const ZOOM_AUTH_SCOPE = process.env.ZOOM_AUTH_SCOPE || "meeting:write meeting:read user:read";

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

interface StoredZoomCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType?: string;
  scope?: string;
}

let zoomTokenCache: ZoomTokenCache | null = null;

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function getZoomClientCredentials() {
  if (!ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("Missing Zoom OAuth credentials. Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET.");
  }

  const creds = `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`;
  return Buffer.from(creds).toString("base64");
}

function getZoomCredentialsDoc() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin setup is incomplete.");
  }
  return db.doc("zoomOauth/credentials");
}

function getZoomStateCollection() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin setup is incomplete.");
  }
  return db.collection("zoomOauthStates");
}

export function getZoomAuthorizationUrl(state: string) {
  if (!ZOOM_CLIENT_ID || !ZOOM_REDIRECT_URI) {
    throw new Error("Zoom OAuth is not configured. Set ZOOM_CLIENT_ID and ZOOM_REDIRECT_URI.");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZOOM_CLIENT_ID,
    redirect_uri: ZOOM_REDIRECT_URI,
    state,
    scope: ZOOM_AUTH_SCOPE,
  });

  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

export async function createZoomAuthState() {
  const state = crypto.randomBytes(16).toString("hex");
  const collection = getZoomStateCollection();
  await collection.doc(state).set({ createdAt: new Date() });
  return state;
}

export async function consumeZoomAuthState(state: string) {
  if (!state) return false;
  const collection = getZoomStateCollection();
  const docRef = collection.doc(state);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  await docRef.delete();
  return true;
}

function normalizeStoredCredentialValue(value: any) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "string") return Number(value);
  return null;
}

async function getStoredZoomCredentials(): Promise<StoredZoomCredentials | null> {
  const doc = await getZoomCredentialsDoc().get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;

  const accessToken = String(data.accessToken || "").trim();
  const refreshToken = String(data.refreshToken || "").trim();
  const expiresAt = normalizeStoredCredentialValue(data.expiresAt);

  if (!accessToken || !refreshToken || !expiresAt) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType: String(data.tokenType || "Bearer"),
    scope: String(data.scope || ""),
  };
}

async function saveZoomCredentials(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType?: string;
  scope?: string;
}) {
  await getZoomCredentialsDoc().set({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    tokenType: tokens.tokenType || "Bearer",
    scope: tokens.scope || ZOOM_AUTH_SCOPE,
    updatedAt: new Date(),
  });

  zoomTokenCache = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  };
}

async function postZoomOAuthToken(params: Record<string, string>) {
  const response = await fetch(ZOOM_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getZoomClientCredentials()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const errorMessage = data?.message || `Zoom OAuth token endpoint responded with ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };
}

async function refreshZoomAccessToken(refreshToken: string) {
  if (!ZOOM_REDIRECT_URI) {
    throw new Error("ZOOM_REDIRECT_URI must be set to refresh Zoom OAuth tokens.");
  }

  const data = await postZoomOAuthToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: ZOOM_REDIRECT_URI,
  });

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  await saveZoomCredentials({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type,
    scope: data.scope,
  });

  return data.access_token;
}

export async function exchangeZoomAuthorizationCode(code: string) {
  if (!ZOOM_REDIRECT_URI) {
    throw new Error("ZOOM_REDIRECT_URI must be set to complete Zoom OAuth authorization.");
  }

  const data = await postZoomOAuthToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: ZOOM_REDIRECT_URI,
  });

  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  await saveZoomCredentials({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type,
    scope: data.scope,
  });

  return data.access_token;
}

async function fetchZoomAccessToken(): Promise<string> {
  if (zoomTokenCache && zoomTokenCache.expiresAt > Date.now() + 10_000) {
    return zoomTokenCache.accessToken;
  }

  const stored = await getStoredZoomCredentials();
  if (stored) {
    if (stored.expiresAt > Date.now() + 10_000) {
      zoomTokenCache = {
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt,
      };
      return stored.accessToken;
    }

    return await refreshZoomAccessToken(stored.refreshToken);
  }

  if (ZOOM_OAUTH_TOKEN_URL.includes("grant_type=account_credentials") || ZOOM_OAUTH_TOKEN_URL.includes("account_credentials")) {
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

  throw new Error(
    "No Zoom OAuth credentials are available. Configure a stored Zoom General App access token or use the Zoom OAuth connect flow."
  );
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

export function createZoomSdkSignature(meetingNumber: string | number, role = 0) {
  if (!ZOOM_SDK_KEY || !ZOOM_SDK_SECRET) {
    throw new Error("Missing Zoom SDK credentials. Set ZOOM_SDK_KEY and ZOOM_SDK_SECRET.");
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60;
  const payload = {
    sdkKey: ZOOM_SDK_KEY,
    mn: Number(meetingNumber),
    role,
    iat,
    exp,
    appKey: ZOOM_SDK_KEY,
    tokenExp: exp,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", ZOOM_SDK_SECRET).update(message).digest("base64url");
  return `${message}.${signature}`;
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
