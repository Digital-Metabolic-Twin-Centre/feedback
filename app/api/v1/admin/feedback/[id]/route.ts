import { NextRequest } from "next/server";
import {
  deleteFeedbackById,
  getFeedbackById,
  getFeedbackStatusIdByName,
  getFeedbackTypeIdByName,
  updateFeedback,
} from "@/lib/feedback/sqlite-queries";
import { logError } from "@/lib/error-logger";
import { authenticateApiKey, requireAdmin, v1Json, v1PreflightResponse } from "@/lib/api-v1";
import {
  PlatformSyncError,
  syncPromotedFeedbackToAvailablePlatforms,
  type PlatformSyncResult,
} from "@/lib/promoted-feedback-sync";

function parseBooleanLike(value: unknown, invalidMessage: string) {
  if (typeof value === "boolean") {
    return { ok: true as const, value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) {
      return { ok: true as const, value: true };
    }
    if (["false", "no", "0"].includes(normalized)) {
      return { ok: true as const, value: false };
    }
  }

  return { ok: false as const, error: invalidMessage };
}

function resolveReferenceId(
  value: unknown,
  lookup: (name: string) => number | null,
  invalidMessage: string
) {
  if (typeof value === "number") {
    return { ok: true as const, id: value };
  }

  if (typeof value === "string") {
    const id = lookup(value);
    if (id !== null) {
      return { ok: true as const, id };
    }
  }

  return { ok: false as const, error: invalidMessage };
}

export async function OPTIONS() {
  return v1PreflightResponse();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return v1Json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const feedback = getFeedbackById(id, authResult.auth.projectId);
    if (!feedback) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    return v1Json({ success: true, data: feedback });
  } catch (err) {
    logError(err, { operation: "v1/admin/feedback GET", resource: req.url });
    const message = err instanceof Error ? err.message : "Internal server error";
    return v1Json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(req);
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
    let syncResults: PlatformSyncResult[] | undefined;

    switch (action) {
      case "type": {
        const resolvedType = resolveReferenceId(value, getFeedbackTypeIdByName, "Invalid type value");
        if (!resolvedType.ok) {
          return v1Json({ success: false, error: resolvedType.error }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_type: resolvedType.id }, authResult.auth.projectId);
        break;
      }

      case "status": {
        const resolvedStatus = resolveReferenceId(value, getFeedbackStatusIdByName, "Invalid status value");
        if (!resolvedStatus.ok) {
          return v1Json({ success: false, error: resolvedStatus.error }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_status: resolvedStatus.id }, authResult.auth.projectId);
        break;
      }

      case "close": {
        const closedStatusId = getFeedbackStatusIdByName("Closed");
        if (closedStatusId === null) {
          return v1Json({ success: false, error: "Closed status not found" }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_status: closedStatusId }, authResult.auth.projectId);
        if (!("error" in result) && result.rowCount > 0) {
          const feedback = getFeedbackById(id, authResult.auth.projectId);
          if (feedback?.promote && !feedback.draft) {
            syncResults = await syncPromotedFeedbackToAvailablePlatforms(id);
          }
        }
        break;
      }

      case "wontfix": {
        const wontFixStatusId = getFeedbackStatusIdByName("Won't Fix");
        if (wontFixStatusId === null) {
          return v1Json({ success: false, error: "Won't Fix status not found" }, { status: 400 });
        }
        result = updateFeedback(id, { feedback_status: wontFixStatusId }, authResult.auth.projectId);
        if (!("error" in result) && result.rowCount > 0) {
          const feedback = getFeedbackById(id, authResult.auth.projectId);
          if (feedback?.promote && !feedback.draft) {
            syncResults = await syncPromotedFeedbackToAvailablePlatforms(id);
          }
        }
        break;
      }

      case "promote": {
        const promoteValue = parseBooleanLike(value, "Invalid promote value");
        if (!promoteValue.ok) {
          return v1Json({ success: false, error: promoteValue.error }, { status: 400 });
        }
        result = updateFeedback(id, { promote: promoteValue.value }, authResult.auth.projectId);
        if (!("error" in result) && result.rowCount > 0 && promoteValue.value) {
          syncResults = await syncPromotedFeedbackToAvailablePlatforms(id);
        }
        break;
      }

      case "draft": {
        const draftValue = parseBooleanLike(value, "Invalid draft value");
        if (!draftValue.ok) {
          return v1Json({ success: false, error: draftValue.error }, { status: 400 });
        }
        result = updateFeedback(id, { draft: draftValue.value }, authResult.auth.projectId);
        if (!("error" in result) && result.rowCount > 0) {
          const feedback = getFeedbackById(id, authResult.auth.projectId);
          if (feedback?.promote && !feedback.draft) {
            syncResults = await syncPromotedFeedbackToAvailablePlatforms(id);
          }
        }
        break;
      }

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

    return v1Json(syncResults ? { success: true, sync: syncResults } : { success: true });
  } catch (err) {
    if (err instanceof PlatformSyncError) {
      logError(err, { operation: "v1/admin/feedback PATCH sync", resource: req.url });
      return v1Json(
        {
          success: false,
          error: err.message,
          sync: {
            failures: err.failures,
            partialResults: err.partialResults,
          },
        },
        { status: 502 },
      );
    }
    logError(err, { operation: "v1/admin/feedback PATCH", resource: req.url });
    const message = err instanceof Error ? err.message : "Internal server error";
    return v1Json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateApiKey(req);
    if (!authResult.ok) return authResult.response;

    const adminError = requireAdmin(authResult.auth);
    if (adminError) return adminError;

    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return v1Json({ success: false, error: "Invalid ID" }, { status: 400 });
    }

    const result = deleteFeedbackById(id, authResult.auth.projectId);
    if ("error" in result) {
      return v1Json({ success: false, error: "Feedback not found for this project." }, { status: 404 });
    }

    return v1Json({
      success: true,
      deletedId: id,
      deletion: result.outcome,
    });
  } catch (err) {
    logError(err, { operation: "v1/admin/feedback DELETE", resource: req.url });
    const message = err instanceof Error ? err.message : "Internal server error";
    return v1Json({ success: false, error: message }, { status: 500 });
  }
}
