import { NextRequest, NextResponse } from "next/server";
import { auth, db, adminInitError } from "@/lib/firebase-admin";

export type AdminAuthResult =
  | { ok: true; uid: string; role: string }
  | { ok: false; response: NextResponse };

export async function verifyAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  if (!auth || !db) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: adminInitError || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      ),
    };
  }

  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 }),
    };
  }

  try {
    const decoded = await auth.verifyIdToken(match[1]);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: "User profile not found" }, { status: 403 }),
      };
    }

    const role = userDoc.data()?.role;
    if (role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      };
    }

    return { ok: true, uid: decoded.uid, role };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }
}
