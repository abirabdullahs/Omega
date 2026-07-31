import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const snap = await db.collection("notices").orderBy("createdAt", "desc").get();
    const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error listing notices:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Failed to list notices", details: initError || undefined }, { status: 500 });
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
    const { title, content, targetLink } = body || {};
    if (!title || !content) return NextResponse.json({ error: "Missing title or content" }, { status: 400 });

    const docRef = await db.collection("notices").add({
      title,
      content,
      targetLink: targetLink || null,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating notice:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Failed to create notice", details: initError || undefined }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase Admin setup is incomplete.", details: getAdminInitError() }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });

    await db.collection("notices").doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting notice:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Failed to delete notice", details: initError || undefined }, { status: 500 });
  }
}
