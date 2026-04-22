import { NextRequest } from "next/server";
import { deleteTableData } from "@/app/actions/delete/action";

import {
  validateRequestBody,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";

import { deleteRequestSchema } from "@/lib/api-validation";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { assertDeleteTableAccess } from "@/lib/api-table-authorization";
import { withRateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-error";

const postHandler = async (req: NextRequest) => {
  try {
    // Ensure valid session
    await verifyToken(req);

    // Validate request body
    const { schema, tableName, where, restoreAction } =
      await validateRequestBody(req, deleteRequestSchema);

    const hasRecordId =
      where &&
      (typeof where.id === "string" || typeof where.id === "number") &&
      String(where.id).trim() !== "";
    if (!hasRecordId) {
      throw new ApiError("Invalid request: where.id is required for delete", 400);
    }

    const action =
      restoreAction === "Restore"
        ? "restore"
        : restoreAction === "Trash"
          ? "trash"
          : "delete";

    const { roles } = await getUserGroupsFromSession();
    assertDeleteTableAccess(roles, tableName, action);

    // Perform delete / restore
    const result = await deleteTableData(schema, tableName, where, restoreAction);

    return successResponse(result);
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const POST = withRateLimit(postHandler);
