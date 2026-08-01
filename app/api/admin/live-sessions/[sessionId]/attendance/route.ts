import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

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

    const attendanceSnap = await db.collection("attendance").where("sessionId", "==", sessionId).get();
    const attendanceList = attendanceSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }));
    const presentStudents = attendanceList.filter((item: any) => item.status === "present") || [];
    const activeStudents = attendanceList.filter((item: any) => item.active) || [];

    const studentsSnap = await db.collection("users").where("role", "==", "student").get();
    const studentIds = studentsSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as Record<string, any>) }));
    const presentIds = new Set<string>(attendanceList.map((item: any) => item.studentId));
    const absentStudents = studentIds.filter((student: any) => !presentIds.has(student.id));

    return NextResponse.json({
      attendance: attendanceList,
      presentStudents,
      absentStudents,
      activeParticipants: activeStudents.length,
      totalStudents: studentIds.length,
    });
  } catch (err: any) {
    console.error("Error fetching attendance:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch attendance", details: getAdminInitError() || undefined }, { status: 500 });
  }
}
