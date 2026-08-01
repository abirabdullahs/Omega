import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest, verifyAuthenticatedRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { createZoomMeeting } from "@/lib/zoom";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const snap = await db.collection("liveSessions").orderBy("startAt", "desc").get();
    const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing live sessions:", err);
    return NextResponse.json({ error: err?.message || "Failed to list live sessions", details: getAdminInitError() || undefined }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const body = await req.json();
    const {
      title,
      topic,
      startAt,
      durationMinutes,
      joinWindowMinutes,
      zoomMeetingId,
      zoomMeetingPassword,
      zoomJoinUrl,
      zoomMeetingInternalId,
      zoomMeetingUuid,
    } = body || {};

    if (!title || !topic || !startAt || !durationMinutes) {
      return NextResponse.json({ error: "Missing required live session fields." }, { status: 400 });
    }

    const sessionData: any = {
      title: String(title).trim(),
      topic: String(topic).trim(),
      startAt: new Date(startAt),
      durationMinutes: Number(durationMinutes),
      joinWindowMinutes: Number(joinWindowMinutes || 0),
      status: "scheduled",
      createdAt: new Date(),
      createdBy: adminCheck.uid,
      updatedAt: new Date(),
    };

    let zoomResult:
      | {
          meetingId: string;
          internalId: string;
          uuid: string;
          joinUrl: string;
          password?: string;
        }
      | null = null;

    if (!zoomMeetingId && !zoomMeetingInternalId) {
      try {
        zoomResult = await createZoomMeeting({
          topic: `${title} — ${topic}`,
          startTime: new Date(startAt).toISOString(),
          durationMinutes: Number(durationMinutes),
          password: zoomMeetingPassword,
        });
      } catch (zoomError: any) {
        console.warn("Zoom meeting creation failed:", zoomError?.message || zoomError);
      }
    }

    if (zoomResult) {
      sessionData.zoomMeetingId = zoomResult.meetingId;
      sessionData.zoomMeetingInternalId = zoomResult.internalId;
      sessionData.zoomMeetingUuid = zoomResult.uuid;
      sessionData.zoomJoinUrl = zoomResult.joinUrl;
      sessionData.zoomMeetingPassword = zoomResult.password || zoomMeetingPassword || null;
    } else {
      if (zoomMeetingId) sessionData.zoomMeetingId = String(zoomMeetingId).trim();
      if (zoomMeetingInternalId) sessionData.zoomMeetingInternalId = String(zoomMeetingInternalId).trim();
      if (zoomMeetingUuid) sessionData.zoomMeetingUuid = String(zoomMeetingUuid).trim();
      if (zoomJoinUrl) sessionData.zoomJoinUrl = String(zoomJoinUrl).trim();
      if (zoomMeetingPassword) sessionData.zoomMeetingPassword = String(zoomMeetingPassword).trim();
    }

    const docRef = await db.collection("liveSessions").add(sessionData);

    return NextResponse.json({ success: true, id: docRef.id, session: { id: docRef.id, ...sessionData } }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating live session:", err);
    return NextResponse.json({ error: err?.message || "Failed to create live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
