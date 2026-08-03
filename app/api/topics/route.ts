import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { findChapterMeta } from "@/lib/subjects";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapterId") || "";
    const studentId = role === "admin" ? searchParams.get("studentId") || "" : uid;
    if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

    let q: FirebaseFirestore.Query = db.collection("topics").where("studentId", "==", studentId);
    if (chapterId) q = q.where("chapterId", "==", chapterId);
    const snap = await q.get();

    const items = snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing topics:", err);
    return NextResponse.json({ error: err?.message || "Failed to list topics" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;
    if (role !== "student") {
      return NextResponse.json({ error: "Only students can add their own topics" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const body = await req.json().catch(() => null);
    const chapterId = typeof body?.chapterId === "string" ? body.chapterId : "";
    const rawNames = typeof body?.names === "string" ? body.names : "";
    if (!chapterId || !rawNames.trim()) {
      return NextResponse.json({ error: "Missing chapterId or topic names" }, { status: 400 });
    }

    const names = rawNames
      .split(",")
      .map((n: string) => n.trim())
      .filter((n: string) => n.length > 0)
      .slice(0, 50); // sane upper bound per request
    if (names.length === 0) {
      return NextResponse.json({ error: "No valid topic names provided" }, { status: 400 });
    }

    const chapterMeta = findChapterMeta(chapterId);
    if (!chapterMeta) {
      return NextResponse.json({ error: "Unknown chapter" }, { status: 400 });
    }

    // Confirm this chapter is actually assigned to the student before
    // letting them add topics under it.
    const assignmentsSnap = await db
      .collection("assignments")
      .where("userId", "==", uid)
      .where("status", "==", "running")
      .get();
    const isAssigned = assignmentsSnap.docs.some((d: any) => {
      const items = d.data()?.items || [];
      return items.some((it: any) => it.chapterId === chapterId);
    });
    if (!isAssigned) {
      return NextResponse.json({ error: "This chapter is not currently assigned to you." }, { status: 403 });
    }

    const existingSnap = await db
      .collection("topics")
      .where("studentId", "==", uid)
      .where("chapterId", "==", chapterId)
      .get();
    let nextOrder = existingSnap.size;

    const batch = db.batch();
    const created: any[] = [];
    for (const name of names) {
      const ref = db.collection("topics").doc();
      const data = {
        studentId: uid,
        chapterId,
        subjectId: chapterMeta.subject.id,
        subjectName: chapterMeta.subject.name,
        name,
        status: "pending",
        order: nextOrder++,
        createdAt: new Date(),
      };
      batch.set(ref, data);
      created.push({ id: ref.id, ...data });
    }
    await batch.commit();

    return NextResponse.json({ success: true, items: created }, { status: 201 });
  } catch (err: any) {
    console.error("Error adding topics:", err);
    return NextResponse.json({ error: err?.message || "Failed to add topics" }, { status: 500 });
  }
}
