import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * GET: preview changes (dry run)
 * POST: perform backfill updates. Accepts JSON { batchSize?: number }
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const snap = await db.collection("users").get();
    type UserDoc = { id: string; data: any };
    const docs: UserDoc[] = snap.docs.map((d: any) => ({ id: d.id, data: d.data() } as UserDoc));
    const toUpdate = docs.filter((d: UserDoc) => !d.data.role || !d.data.createdAt).map((d: UserDoc) => ({ id: d.id, roleMissing: !d.data.role, createdAtMissing: !d.data.createdAt }));
    return NextResponse.json({ total: docs.length, toUpdate, count: toUpdate.length });
  } catch (err: any) {
    console.error("Backfill preview error:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Server error", details: initError || undefined }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "Firebase Admin not configured", details: getAdminInitError() }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batchSize) || 500;

    const snap = await db.collection("users").get();
    type UserDoc = { id: string; data: any };
    const docs: UserDoc[] = snap.docs.map((d: any) => ({ id: d.id, data: d.data() } as UserDoc));
    const toUpdate = docs.filter((d: UserDoc) => !d.data.role || !d.data.createdAt);

    let updated = 0;
    // Process in sequential batches to avoid long transactions
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batchDocs = toUpdate.slice(i, i + batchSize);
      const batch = db.batch();
      for (const docInfo of batchDocs) {
        const docRef = db.collection("users").doc(docInfo.id);
        const updates: any = {};
        if (!docInfo.data.role) updates.role = "student";
        if (!docInfo.data.createdAt) updates.createdAt = Date.now();
        batch.update(docRef, updates);
      }
      await batch.commit();
      updated += batchDocs.length;
    }

    return NextResponse.json({ success: true, updated });
  } catch (err: any) {
    console.error("Backfill apply error:", err);
    const initError = getAdminInitError();
    return NextResponse.json({ error: err?.message || "Server error", details: initError || undefined }, { status: 500 });
  }
}
