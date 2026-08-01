import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminInitError } from "@/lib/firebase-admin";

export type AdminAuthResult =
  | { ok: true; uid: string; role: string }
  | { ok: false; response: NextResponse };

export async function verifyAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  if (!auth || !db) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details:
            getAdminInitError() ||
            "Add FIREBASE_SERVICE_ACCOUNT_JSON to the Vercel Production environment, then redeploy.",
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
  } catch (err: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired token", details: err?.message },
        { status: 401 }
      ),
    };
  }
}

// Same as verifyAdminRequest but accepts any signed-in role (student or admin).
// Used by endpoints that both portals call, where the caller's own role
// decides what the endpoint is allowed to do.
export async function verifyAuthenticatedRequest(req: NextRequest): Promise<AdminAuthResult> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  if (!auth || !db) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details:
            getAdminInitError() ||
            "Add FIREBASE_SERVICE_ACCOUNT_JSON to the Vercel Production environment, then redeploy.",
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
    if (role !== "admin" && role !== "student") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unrecognized role" }, { status: 403 }),
      };
    }

    return { ok: true, uid: decoded.uid, role };
  } catch (err: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired token", details: err?.message },
        { status: 401 }
      ),
    };
  }
}
