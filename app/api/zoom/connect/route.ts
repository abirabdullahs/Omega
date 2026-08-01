import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { createZoomAuthState, getZoomAuthorizationUrl } from "@/lib/zoom";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdminRequest(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const state = await createZoomAuthState();
    const authUrl = getZoomAuthorizationUrl(state);
    return NextResponse.json({ success: true, authUrl });
  } catch (err: any) {
    console.error("Zoom connect URL generation failed:", err);
    return NextResponse.json(
      { error: err?.message || "Unable to generate Zoom authorization URL." },
      { status: 500 }
    );
  }
}
