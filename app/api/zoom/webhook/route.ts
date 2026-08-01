import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import crypto from "crypto";

export const runtime = "nodejs";

const WEBHOOK_SECRET =
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN ||
  process.env.ZOOM_WEBHOOK_SECRET ||
  process.env.ZOOM_WEBHOOK_TOKEN ||
  "";

function verifyZoomWebhook(req: NextRequest, rawBody: string): boolean {
  if (!WEBHOOK_SECRET) return false;

  const timestamp =
    req.headers.get("x-zm-request-timestamp") ||
    req.headers.get("zoom-request-timestamp") ||
    "";

  const received =
    req.headers.get("x-zm-signature") ||
    req.headers.get("zoom-signature") ||
    "";

  if (!timestamp || !received) {
    return false;
  }

  const message = `v0:${timestamp}:${rawBody}`;

  const expected =
    "v0=" +
    crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(message)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received)
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Zoom endpoint validation
    if (payload.event === "endpoint.url_validation") {
      const plainToken =
        payload.payload?.plainToken ||
        payload.payload?.plain_token ||
        "";

      const encryptedToken = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(plainToken)
        .digest("hex");

      return NextResponse.json({
        plainToken,
        encryptedToken,
      });
    }

    // Verify all other webhook requests
    if (!verifyZoomWebhook(req, rawBody)) {
      return NextResponse.json(
        { error: "Invalid Zoom webhook signature." },
        { status: 401 }
      );
    }

    const event = payload.event;
    const object = payload.payload?.object;
    const participant = object?.participant;

    const meetingUuid = object?.uuid;
    const meetingNumber = String(
      object?.id || object?.meeting_number || ""
    );

    const db = getAdminDb();

    if (!db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError(),
        },
        { status: 500 }
      );
    }

    if (!meetingUuid && !meetingNumber) {
      return NextResponse.json(
        { error: "Zoom meeting identifier missing." },
        { status: 400 }
      );
    }

    const sessionQuery = meetingUuid
      ? db
          .collection("liveSessions")
          .where("zoomMeetingUuid", "==", meetingUuid)
          .limit(1)
      : db
          .collection("liveSessions")
          .where("zoomMeetingId", "==", meetingNumber)
          .limit(1);

    const sessionSnap = await sessionQuery.get();

    if (sessionSnap.empty) {
      return NextResponse.json({
        success: true,
        message: "No matching live session.",
      });
    }

    const sessionId = sessionSnap.docs[0].id;

    const email = participant?.email;
    const userName =
      participant?.user_name ||
      participant?.name ||
      null;

    const studentId = email
      ? await findStudentIdByZoomEmail(db, email)
      : null;

    if (!studentId) {
      return NextResponse.json({
        success: true,
        message: "Student not found.",
      });
    }

    const attendanceRef = db
      .collection("attendance")
      .doc(`${sessionId}_${studentId}`);

    if (event === "meeting.participant_joined") {
      await attendanceRef.set(
        {
          sessionId,
          studentId,
          studentName: userName,
          joinedAt: new Date(),
          active: true,
          status: "present",
        },
        { merge: true }
      );
    }

    if (event === "meeting.participant_left") {
      await attendanceRef.set(
        {
          sessionId,
          studentId,
          studentName: userName,
          leftAt: new Date(),
          active: false,
        },
        { merge: true }
      );
    }

    if (event === "meeting.ended") {
      await db.collection("liveSessions").doc(sessionId).set(
        {
          status: "ended",
          endedAt: new Date(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message || "Webhook failed",
        details: getAdminInitError() || undefined,
      },
      { status: 500 }
    );
  }
}

async function findStudentIdByZoomEmail(
  db: any,
  email: string
): Promise<string | null> {
  const snap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return snap.docs[0].id;
}