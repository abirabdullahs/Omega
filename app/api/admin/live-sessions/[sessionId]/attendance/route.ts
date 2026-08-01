import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const sessionDoc = await db.collection("liveSessions").doc(params.sessionId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Live session not found." }, { status: 404 });
    }

    const attendanceSnap = await db.collection("attendance").where("sessionId", "==", params.sessionId).get();
    const attendanceList = attendanceSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const presentStudents = attendanceList.filter((item) => item.status === "present") || [];
    const activeStudents = attendanceList.filter((item) => item.active) || [];

    const studentsSnap = await db.collection("users").where("role", "==", "student").get();
    const studentIds = studentsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const presentIds = new Set<string>(attendanceList.map((item) => item.studentId));
    const absentStudents = studentIds.filter((student) => !presentIds.has(student.id));

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
