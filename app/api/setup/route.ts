import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase-admin";
import { formatPhoneToEmail } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const usersCount = (await db.collection("users").count().get()).data().count;
    
    if (usersCount > 0) {
      return NextResponse.json({ message: "System already setup" }, { status: 403 });
    }

    const adminPhone = "01700000000"; // Default admin phone
    const adminEmail = formatPhoneToEmail(adminPhone);
    const adminPassword = "admin-password-123";

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
