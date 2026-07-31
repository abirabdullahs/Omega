import { NextRequest, NextResponse } from "next/server";
import { auth, db, adminInitError } from "@/lib/firebase-admin";
import { formatPhoneToEmail, getDefaultPassword } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
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

    const results = [];
    for (const student of students) {
      const { phone, name } = student;
      if (!phone) continue;

      const email = formatPhoneToEmail(phone);
      const password = getDefaultPassword(phone);

      try {
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: name || `Student ${phone.slice(-4)}`,
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

    return NextResponse.json({ 
      success: true, 
      results
    });
  } catch (error: any) {
    console.error("Error creating student:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const studentsSnapshot = await db.collection("users").where("role", "==", "student").get();
    const students = studentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(students);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
