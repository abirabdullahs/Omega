import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { createZoomSdkSignature } from "@/lib/zoom";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const body = await req.json();
    const { sessionId } = body || {};
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }

    const sessionDoc = await db.collection("liveSessions").doc(String(sessionId)).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    const session: any = sessionDoc.data();
    const meetingNumber = session.zoomMeetingId ? String(session.zoomMeetingId).trim() : null;
    const password = session.zoomMeetingPassword ? String(session.zoomMeetingPassword) : "";

    if (meetingNumber) {
      const signature = createZoomSdkSignature(meetingNumber, 1);
      return NextResponse.json({
        success: true,
        meetingNumber,
        password,
        sdkKey: process.env.ZOOM_SDK_KEY || "",
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
    console.error("Error preparing admin live session join:", err);
    return NextResponse.json({ error: err?.message || "Failed to prepare admin live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
