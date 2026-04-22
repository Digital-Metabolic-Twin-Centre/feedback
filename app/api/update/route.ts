import { NextRequest } from "next/server";
import { updateTableData } from "@/app/actions/update/action";
import {
  validateRequestBody,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { updateRequestSchema } from "@/lib/api-validation";
import { withRateLimit } from "@/lib/rate-limit";
import { syncPromotedFeedbackToGitLab } from "@/lib/gitlab-feedback-sync";
import { logError } from "@/lib/error-logger";
import { ApiError } from "@/lib/api-error";

const postHandler = async (req: NextRequest) => {
  try {
    // Feedbacks are publicly writable — no login needed.
    const bodyClone = req.clone();
    const rawBody = await bodyClone.json().catch(() => ({}));
    const isFeedbacksTable = rawBody?.tableName === "feedbacks";

    await verifyToken(req, isFeedbacksTable);

    const { schema, tableName, updates, where } =
      await validateRequestBody(req, updateRequestSchema);

    const hasRecordId =
      where &&
      (typeof where.id === "string" || typeof where.id === "number") &&
      String(where.id).trim() !== "";
    if (!hasRecordId) {
      throw new ApiError("Invalid request: where.id is required for update", 400);
    }

    const targetId = Number(where?.id);
    const result = await updateTableData(schema, tableName, updates, where);

    if (tableName === "feedbacks" && result?.success && Number.isFinite(targetId) && targetId > 0) {
      syncPromotedFeedbackToGitLab(targetId).catch((err) =>
        logError(err, { operation: "SyncPromotedFeedbackToGitLabOnUpdate", metadata: { feedbackId: targetId } }, "error")
      );
    }

    return successResponse(result);
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const POST = withRateLimit(postHandler);
