import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: any) {
  try {
    const params = ctx?.params;
    const routeParams = params instanceof Promise ? await params : params;
    const topicId = String(routeParams?.topicId || "");
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    const { uid, role } = authResult;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const ref = db.collection("topics").doc(topicId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    const data: any = snap.data();
    if (role !== "admin" && data.studentId !== uid) {
      return NextResponse.json({ error: "You can only edit your own topics" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    await ref.update({ name, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error renaming topic:", err);
    return NextResponse.json({ error: err?.message || "Failed to rename topic" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: any) {
  try {
    const params = ctx?.params;
    const routeParams = params instanceof Promise ? await params : params;
    const topicId = String(routeParams?.topicId || "");
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    if (authResult.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete topics" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const ref = db.collection("topics").doc(topicId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting topic:", err);
    return NextResponse.json({ error: err?.message || "Failed to delete topic" }, { status: 500 });
  }
}
