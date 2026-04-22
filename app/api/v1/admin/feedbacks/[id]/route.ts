import { NextRequest } from "next/server";
import { updateFeedback } from "@/lib/feedback/sqlite-queries";
import { syncPromotedFeedbackToGitLab } from "@/lib/gitlab-feedback-sync";
import { logError } from "@/lib/error-logger";
import { authenticateApiKey, requireAdmin, v1Json, v1PreflightResponse } from "@/lib/api-v1";

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return v1Json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { action, value } = body;

    let result: ReturnType<typeof updateFeedback>;

    switch (action) {
      case "status":
        if (typeof value !== "number") {
          return v1Json({ success: false, error: "Invalid status value" }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_status: value }, authResult.auth.projectId);
        break;

      case "close":
        result = updateFeedback(id, { feedback_status: 5 }, authResult.auth.projectId);
        break;

      case "wontfix":
        result = updateFeedback(id, { feedback_status: 6 }, authResult.auth.projectId);
        break;

      case "promote":
        result = updateFeedback(id, { promote: true }, authResult.auth.projectId);
        if (!("error" in result) && result.rowCount > 0) {
          syncPromotedFeedbackToGitLab(id).catch((err) => {
            logError(err, { operation: "syncPromotedFeedbackToGitLab", resource: String(id) });
          });
        }
        break;

      case "delete":
        result = updateFeedback(id, { soft_delete: true }, authResult.auth.projectId);
        break;

      case "restore":
        result = updateFeedback(id, { soft_delete: false }, authResult.auth.projectId);
        break;

      default:
        return v1Json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    if ("error" in result) {
      return v1Json({ success: false, error: result.error }, { status: 400 });
    }

    if (result.rowCount < 1) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    return v1Json({ success: true });
  } catch (err) {
    logError(err, { operation: "v1/admin/feedbacks PATCH", resource: req.url });
    const message = err instanceof Error ? err.message : "Internal server error";
    return v1Json({ success: false, error: message }, { status: 500 });
  }
}
