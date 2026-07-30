import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  // Simple middleware for session-based checks if needed, 
  // but for now we'll handle routing in the pages themselves or via a layout guard.
  // Actually, we should protect /admin and /student.
  
  // Note: Firebase Auth tokens are usually handled client-side.
  // For true middleware protection we'd need session cookies.
  // Given the scope, client-side guards are often sufficient and easier to implement with standard Firebase SDK.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
