import { NextRequest } from "next/server";
import { insertTabledata } from "@/app/actions/create/action";
import {
  validateRequestBody,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { createRequestSchema } from "@/lib/api-validation";
import { withRateLimit } from "@/lib/rate-limit";

const postHandler = async (req: NextRequest) => {
  try {
    // Feedbacks are publicly writable — no login needed.
    const bodyClone = req.clone();
    const rawBody = await bodyClone.json().catch(() => ({}));
    const isFeedbacksTable = rawBody?.tableName === "feedbacks";

    await verifyToken(req, isFeedbacksTable);

    const { schema, tableName, data } = await validateRequestBody(req, createRequestSchema);
    const result = await insertTabledata(schema, tableName, data);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error, req);
  }
};

export const POST = withRateLimit(postHandler);
