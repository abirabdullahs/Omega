import { NextRequest, NextResponse } from "next/server";
import { consumeZoomAuthState, exchangeZoomAuthorizationCode } from "@/lib/zoom";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code") || "";
    const state = req.nextUrl.searchParams.get("state") || "";
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.json({ error: `Zoom authorization failed: ${error}` }, { status: 400 });
    }

    if (!code || !state) {
      return NextResponse.json({ error: "Missing Zoom authorization code or state." }, { status: 400 });
    }

    const validState = await consumeZoomAuthState(state);
    if (!validState) {
      return NextResponse.json({ error: "Invalid or expired Zoom OAuth state." }, { status: 400 });
    }

    await exchangeZoomAuthorizationCode(code);
    return NextResponse.json({ success: true, message: "Zoom OAuth completed. The Zoom meeting API is now connected." });
  } catch (err: any) {
    console.error("Zoom callback failed:", err);
    return NextResponse.json(
      { error: err?.message || "Zoom OAuth callback processing failed." },
      { status: 500 }
    );
  }
}
