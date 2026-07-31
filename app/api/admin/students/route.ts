import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { formatPhoneToEmail, getDefaultPassword } from "@/lib/auth-utils";
import { verifyAdminRequest } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }

    const { students } = await req.json();

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid students data" }, { status: 400 });
    }

    const results: { phone: string; success: boolean; skipped?: boolean; error?: string }[] = [];
    for (const student of students) {
      const { phone, name } = student;
      if (!phone) continue;

      // Check if a user doc with this phone already exists
      try {
        const existingSnap = await db.collection("users").where("phone", "==", phone).limit(1).get();
        if (!existingSnap.empty) {
          // Already exists — skip creating
          results.push({ phone, success: false, skipped: true, error: "Already exists" });
          continue;
        }
      } catch (err: any) {
        // If query failed, report and skip
        results.push({ phone, success: false, error: `Lookup failed: ${err?.message || err}` });
        continue;
      }

      const email = formatPhoneToEmail(phone);
      let password: string;
      try {
        password = getDefaultPassword(phone);
      } catch (err: any) {
        results.push({ phone, success: false, error: err.message });
        continue;
      }

      try {
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: name || `Student ${String(phone).replace(/\D/g, "").slice(-4)}`,
        });

        // Store createdAt as a numeric timestamp to support cursor pagination
        await db.collection("users").doc(userRecord.uid).set({
          phone,
          name: name || "",
          role: "student",
          passwordChanged: false,
          createdAt: Date.now(),
        });

        results.push({ phone, success: true });
      } catch (err: any) {
        results.push({ phone, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json(
      {
        success: successCount > 0,
        results,
        successCount,
        failureCount,
        error: successCount === 0 ? "No students were created" : undefined,
      },
      { status: successCount > 0 ? 200 : 400 }
    );
  } catch (error: any) {
    console.error("Error creating student:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      {
        error: error?.message || "Failed to create students",
        details: initError || undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isNaN(limitParam) ? 20 : Math.max(1, Math.min(100, limitParam));
    const cursorParam = searchParams.get("cursor");
    const qParam = (searchParams.get("q") || "").trim();

    // If qParam provided, perform prefix search on name (or phone if numeric).
    if (qParam) {
      const isPhoneSearch = /^\d+$/.test(qParam);
      const field = isPhoneSearch ? "phone" : "name";
      // Range for prefix search
      const start = qParam;
      const end = qParam + "\uf8ff";

      let qQuery: any = db.collection("users").where("role", "==", "student").where(field, ">=", start).where(field, "<=", end).orderBy(field, "asc");
      if (cursorParam) {
        // cursor for search is the last seen field value
        qQuery = qQuery.startAfter(cursorParam);
      }
      qQuery = qQuery.limit(limit + 1);
      const studentsSnapshot = await qQuery.get();
      const docs = studentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      let nextCursor: string | null = null;
      if (docs.length > limit) {
        const last = docs[limit - 1];
        nextCursor = last?.[field] || null;
      }
      const pageItems = docs.slice(0, limit);
      return NextResponse.json({ items: pageItems, nextCursor });
    }

    // Default: paginate by createdAt (desc)
    {
      const cursorNum = cursorParam ? parseInt(cursorParam, 10) : NaN;
      let q: any = db.collection("users").where("role", "==", "student").orderBy("createdAt", "desc");
      if (!Number.isNaN(cursorNum)) {
        q = q.startAfter(cursorNum);
      }
      q = q.limit(limit + 1); // fetch one extra to determine nextCursor
      const studentsSnapshot = await q.get();
      const docs = studentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      let nextCursor: string | null = null;
      if (docs.length > limit) {
        const last = docs[limit - 1];
        nextCursor = String(last?.createdAt || null);
      }

      const pageItems = docs.slice(0, limit);
      return NextResponse.json({ items: pageItems, nextCursor });
    }
  } catch (error: any) {
    console.error("Error listing students:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      {
        error: error?.message || "Failed to list students",
        details: initError || undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId parameter" }, { status: 400 });
    }

    try {
      await auth.deleteUser(studentId);
    } catch (authErr: any) {
      console.warn("Auth user deletion warning:", authErr?.message);
    }

    await db.collection("users").doc(studentId).delete();

    return NextResponse.json({ success: true, message: "Student account deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting student:", error);
    const initError = getAdminInitError();
    return NextResponse.json(
      {
        error: error?.message || "Failed to delete student",
        details: initError || undefined,
      },
      { status: 500 }
    );
  }
}
