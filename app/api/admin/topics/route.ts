import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const [topicsSnap, studentsSnap] = await Promise.all([
      db.collection("topics").get(),
      db.collection("users").where("role", "==", "student").get(),
    ]);

    const studentsById: Record<string, any> = {};
    studentsSnap.docs.forEach((d: any) => {
      const data = d.data() || {};
      studentsById[d.id] = { id: d.id, name: data.name || null, phone: data.phone || null };
    });

    // Group topics by studentId -> chapterId -> [topics]
    const grouped: Record<string, { student: any; chapters: Record<string, any[]> }> = {};
    topicsSnap.docs.forEach((d: any) => {
      const data = d.data() || {};
      const sid = data.studentId;
      if (!sid) return;
      if (!grouped[sid]) {
        grouped[sid] = {
          student: studentsById[sid] || { id: sid, name: null, phone: null },
          chapters: {},
        };
      }
      const key = data.chapterId || "unknown";
      if (!grouped[sid].chapters[key]) grouped[sid].chapters[key] = [];
      grouped[sid].chapters[key].push({ id: d.id, ...data });
    });

    Object.values(grouped).forEach((entry) => {
      Object.values(entry.chapters).forEach((list: any) => {
        list.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      });
    });

    const items = Object.values(grouped);
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing all topics:", err);
    return NextResponse.json({ error: err?.message || "Failed to list topics" }, { status: 500 });
  }
}
