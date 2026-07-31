import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminInitError } from "@/lib/firebase-admin";
import { formatPhoneToEmail } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret) {
      return NextResponse.json(
        { error: "Setup is locked. Set SETUP_SECRET in the environment to enable bootstrap." },
        { status: 403 }
      );
    }

    const provided =
      req.headers.get("x-setup-secret") ||
      new URL(req.url).searchParams.get("secret");

    if (!provided || provided !== setupSecret) {
      return NextResponse.json({ error: "Invalid or missing setup secret" }, { status: 403 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    if (!auth || !db) {
      return NextResponse.json(
        {
          error: "Firebase Admin setup is incomplete.",
          details: getAdminInitError() || "Check Firebase credentials and try again.",
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

    const payload: Record<string, string> = {
      message: "Admin created successfully",
      phone: adminPhone,
    };

    if (process.env.NODE_ENV !== "production") {
      payload.password = adminPassword;
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
