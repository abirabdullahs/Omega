import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/api-auth";
import { notifyAllStudents } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.slice(0, 140) : "";
    const taskId = typeof body?.taskId === "string" ? body.taskId : undefined;
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

    await notifyAllStudents(
      {
        type: "task",
        title: `New task: ${title}`,
        link: taskId ? `/student/tasks/${taskId}` : "/student",
      },
      taskId ? `task_${taskId}` : undefined
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error notifying task creation:", error);
    return NextResponse.json({ error: error?.message || "Failed to notify" }, { status: 500 });
  }
}
