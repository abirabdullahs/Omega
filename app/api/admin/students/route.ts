import { NextRequest, NextResponse } from "next/server";
import { auth, db, adminInitError } from "@/lib/firebase-admin";
import { formatPhoneToEmail, getDefaultPassword } from "@/lib/auth-utils";
import { verifyAdminRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const adminCheck = await verifyAdminRequest(req);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: adminInitError || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }

    const { students } = await req.json();

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid students data" }, { status: 400 });
    }

    const results: { phone: string; success: boolean; error?: string }[] = [];
    for (const student of students) {
      const { phone, name } = student;
      if (!phone) continue;

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

        await db.collection("users").doc(userRecord.uid).set({
          phone,
          name: name || "",
          role: "student",
          passwordChanged: false,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const adminCheck = await verifyAdminRequest(req);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    if (!db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: adminInitError || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
        },
        { status: 500 }
      );
    }
    const studentsSnapshot = await db.collection("users").where("role", "==", "student").get();
    const students = studentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(students);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminCheck = await verifyAdminRequest(req);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: adminInitError || "Add FIREBASE_SERVICE_ACCOUNT_JSON in your deployment environment.",
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
