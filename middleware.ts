import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection for /admin and /student is handled by:
 * - Client layout guards (role + passwordChanged)
 * - Firebase ID token checks on /api/admin/*
 * - Firestore security rules
 *
 * Cookie-based middleware auth can be added later if server-rendered
 * protection is required.
 */
export async function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
