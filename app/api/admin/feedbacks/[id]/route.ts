import { NextRequest, NextResponse } from "next/server";
import { updateFeedback } from "@/lib/feedback/sqlite-queries";
import { syncPromotedFeedbackToGitLab } from "@/lib/gitlab-feedback-sync";
import { logError } from "@/lib/error-logger";

function getAdminEmails(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { action, value, admin_email } = body;

    if (!admin_email || !isAdminEmail(admin_email)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let result: ReturnType<typeof updateFeedback>;

    switch (action) {
      case "status":
        if (typeof value !== "number") {
          return NextResponse.json({ success: false, error: "Invalid status value" }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_status: value });
        break;

      case "close":
        result = updateFeedback(id, { feedback_status: 5 });
        break;

      case "wontfix":
        result = updateFeedback(id, { feedback_status: 6 });
        break;

      case "promote":
        result = updateFeedback(id, { promote: true });
        if (!("error" in result)) {
          // fire-and-forget
          syncPromotedFeedbackToGitLab(id).catch((err) => {
            logError(err, { operation: "syncPromotedFeedbackToGitLab", resource: String(id) });
          });
        }
        break;

      case "delete":
        result = updateFeedback(id, { soft_delete: true });
        break;

      case "restore":
        result = updateFeedback(id, { soft_delete: false });
        break;

      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logError(err, { operation: "admin/feedbacks PATCH", resource: req.url });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
