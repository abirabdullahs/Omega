import { NextRequest, NextResponse } from "next/server";
import { auth, db, adminInitError } from "@/lib/firebase-admin";
import { formatPhoneToEmail } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: adminInitError || "Check Firebase credentials and try again.",
        },
        { status: 500 }
      );
    }

    const usersCount = (await db.collection("users").count().get()).data().count;
    
    if (usersCount > 0) {
      return NextResponse.json({ message: "System already setup" }, { status: 403 });
    }

    const adminPhone = process.env.ADMIN_PHONE || "01700000000";
    const adminEmail = process.env.ADMIN_EMAIL || formatPhoneToEmail(adminPhone);
    const adminPassword = process.env.ADMIN_PASSWORD || "admin-password-123";

    const userRecord = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: "Admin",
    });

    await db.collection("users").doc(userRecord.uid).set({
      phone: adminPhone,
      role: "admin",
      passwordChanged: true,
    });

    return NextResponse.json({ 
      message: "Admin created successfully", 
      phone: adminPhone, 
      password: adminPassword 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
