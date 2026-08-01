import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticatedRequest } from "@/lib/api-auth";
import { notifyAllAdmins } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAuthenticatedRequest(req);
    if (!authResult.ok) return authResult.response;
    if (authResult.role !== "student") {
      return NextResponse.json({ error: "Only students can submit tasks" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const taskId = typeof body?.taskId === "string" ? body.taskId : "";
    const taskTitle = typeof body?.taskTitle === "string" ? body.taskTitle.slice(0, 100) : "a task";
    const studentName = typeof body?.studentName === "string" ? body.studentName.slice(0, 60) : "A student";
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

    await notifyAllAdmins(
      {
        type: "submission",
        title: `${studentName} submitted "${taskTitle}"`,
        link: `/admin/submissions`,
      },
      `submission_${taskId}_${authResult.uid}`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error notifying submission:", error);
    return NextResponse.json({ error: error?.message || "Failed to notify" }, { status: 500 });
  }
}
