import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { endZoomMeeting, updateZoomMeeting } from "@/lib/zoom";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: any) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const params = ctx?.params;
    const routeParams = params instanceof Promise ? await params : params;
    const sessionId = String(routeParams?.sessionId || "");

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const sessionDoc = await db.collection("liveSessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    return NextResponse.json({ session: { id: sessionDoc.id, ...sessionDoc.data() } });
  } catch (err: any) {
    console.error("Error fetching live session:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: any) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const params = ctx?.params;
    const routeParams = params instanceof Promise ? await params : params;
    const sessionId = String(routeParams?.sessionId || "");

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const sessionRef = db.collection("liveSessions").doc(sessionId);
    const snapshot = await sessionRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    const body = await req.json();
    const {
      action,
      title,
      topic,
      startAt,
      durationMinutes,
      joinWindowMinutes,
      zoomMeetingPassword,
      zoomMeetingId,
    } = body || {};

    const existingSession: any = snapshot.data();
    const updateData: any = { updatedAt: new Date() };

    if (action === "start") {
      updateData.status = "live";
    } else if (action === "end") {
      updateData.status = "ended";
      updateData.endedAt = new Date();
      if (existingSession?.zoomMeetingInternalId) {
        try {
          await endZoomMeeting(existingSession.zoomMeetingInternalId);
        } catch (zoomError: any) {
          console.warn("Zoom end meeting failed:", zoomError?.message || zoomError);
        }
      }
      const attendanceSnapshot = await db.collection("attendance")
        .where("sessionId", "==", sessionId)
        .where("active", "==", true)
        .get();
      const batch = db.batch();
      attendanceSnapshot.docs.forEach((doc: any) => {
        batch.update(doc.ref, { active: false, leftAt: new Date() });
      });
      if (!attendanceSnapshot.empty) {
        await batch.commit();
      }
    } else if (action === "cancel") {
      updateData.status = "cancelled";
      updateData.cancelledAt = new Date();
    } else {
      if (title !== undefined) updateData.title = String(title).trim();
      if (topic !== undefined) updateData.topic = String(topic).trim();
      if (startAt !== undefined) updateData.startAt = new Date(startAt);
      if (durationMinutes !== undefined) updateData.durationMinutes = Number(durationMinutes);
      if (joinWindowMinutes !== undefined) updateData.joinWindowMinutes = Number(joinWindowMinutes);
      if (zoomMeetingPassword !== undefined) updateData.zoomMeetingPassword = zoomMeetingPassword || null;
      if (zoomMeetingId !== undefined) updateData.zoomMeetingId = zoomMeetingId || null;

      if (existingSession?.zoomMeetingInternalId) {
        try {
          await updateZoomMeeting(existingSession.zoomMeetingInternalId, {
            topic: updateData.topic || existingSession.topic,
            startTime: updateData.startAt ? new Date(updateData.startAt).toISOString() : undefined,
            durationMinutes: updateData.durationMinutes,
            password: updateData.zoomMeetingPassword,
          });
        } catch (zoomError: any) {
          console.warn("Zoom meeting update failed:", zoomError?.message || zoomError);
        }
      }
    }

    await sessionRef.update(updateData);
    const updatedSession = await sessionRef.get();

    return NextResponse.json({ success: true, session: { id: updatedSession.id, ...updatedSession.data() } });
  } catch (err: any) {
    console.error("Error updating live session:", err);
    return NextResponse.json({ error: err?.message || "Failed to update live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: any) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const params = ctx?.params;
    const routeParams = params instanceof Promise ? await params : params;
    const sessionId = String(routeParams?.sessionId || "");

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const sessionRef = db.collection("liveSessions").doc(sessionId);
    const snapshot = await sessionRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    await sessionRef.update({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error cancelling live session:", err);
    return NextResponse.json({ error: err?.message || "Failed to cancel live session", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
