import { NextRequest } from "next/server";
import { bulkInsertIdentifiers } from "@/app/actions/create/identifiers/action";
import {
  validateRequestBody,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { bulkIdentifiersSchema } from "@/lib/api-validation";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { assertCreateTableAccess } from "@/lib/api-table-authorization";
import { withRateLimit } from "@/lib/rate-limit";


const postHandler = async (req: NextRequest) => {
  try {
    // Verify token 
    await verifyToken(req);

    // Validate request body against schema
    const { schema, tableName, data, count } = await validateRequestBody(
      req,
      bulkIdentifiersSchema
    );

    const { roles } = await getUserGroupsFromSession();
    assertCreateTableAccess(roles, tableName);

    // Perform action
    const result = await bulkInsertIdentifiers(schema, tableName, data, count);

    // Standard response
    return successResponse(result);
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const POST = withRateLimit(postHandler);
