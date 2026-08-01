import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { createZoomSdkSignature } from "@/lib/zoom";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    if (authResult.role !== "student") {
      return NextResponse.json({ error: "Only students may join live sessions." }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId } = body || {};
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const sessionDoc = await db.collection("liveSessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    const session: any = sessionDoc.data();
    const now = Date.now();
    const startAtMs = session.startAt?.toMillis ? session.startAt.toMillis() : new Date(session.startAt).getTime();
    const durationMinutes = Number(session.durationMinutes || 0);
    const endAtMs = startAtMs + durationMinutes * 60 * 1000;
    const joinWindowMinutes = Number(session.joinWindowMinutes || 0);
    const earliestJoinMs = startAtMs - joinWindowMinutes * 60 * 1000;

    if (session.status === "cancelled") {
      return NextResponse.json({ error: "This live session has been cancelled." }, { status: 403 });
    }

    if (now < earliestJoinMs) {
      return NextResponse.json({ error: "This session is not open for joining yet." }, { status: 403 });
    }

    if (now >= endAtMs) {
      return NextResponse.json({ error: "This session has already ended." }, { status: 403 });
    }

    const userDoc = await db.collection("users").doc(authResult.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Student profile missing." }, { status: 403 });
    }

    const attendanceId = `${sessionId}_${authResult.uid}`;
    await db.collection("attendance").doc(attendanceId).set(
      {
        sessionId,
        studentId: authResult.uid,
        studentName: userDoc.data()?.name || null,
        joinedAt: new Date(),
        active: true,
        status: "present",
      },
      { merge: true }
    );

    const meetingNumber = session.zoomMeetingId ? String(session.zoomMeetingId).trim() : null;
    const password = session.zoomMeetingPassword ? String(session.zoomMeetingPassword) : "";
    const sdkKey = process.env.ZOOM_SDK_KEY || "";

    if (meetingNumber && sdkKey && process.env.ZOOM_SDK_SECRET) {
      const signature = createZoomSdkSignature(meetingNumber, 0);
      return NextResponse.json({
        success: true,
        meetingNumber,
        password,
        sdkKey,
        signature,
        topic: session.title || session.topic || "Live session",
      });
    }

    const meetingUrl = session.zoomJoinUrl
      ? session.zoomJoinUrl
      : meetingNumber
      ? `https://zoom.us/j/${encodeURIComponent(meetingNumber)}${password ? `?pwd=${encodeURIComponent(password)}` : ""}`
      : null;

    if (!meetingUrl) {
      return NextResponse.json({ error: "Meeting details are not available." }, { status: 500 });
    }

    return NextResponse.json({ success: true, meetingUrl });
  } catch (err: any) {
    console.error("Error joining live session:", err);
    return NextResponse.json({ error: err?.message || "Failed to join live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
