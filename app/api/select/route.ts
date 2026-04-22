/**
 * API Route: /api/select
 *
 * Purpose:
 * Fetches rows from a specific table within a schema, with optional filters and group-based access.
 *
 * Authorization:
 * - Requires a valid session token via NextAuth (except public analytics tables)
 */

import { NextRequest } from "next/server";
import { getTableData } from "@/app/actions/select/action";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { getSystemSetting } from "@/lib/queries/select/administrative/system-settings";

import {
  validateQueryParams,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { corsHeaders } from "@/lib/cors";
import { selectQuerySchema, validateDateField } from "@/lib/api-validation";
import { assertSelectTableAccess } from "@/lib/api-table-authorization";
import { publicTables } from "@/lib/constants";
import { withRateLimit } from "@/lib/rate-limit";

// CORS Preflight handler
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, { allowCredentials: true });
  return new Response(null, { status: 204, headers });
}

const getHandler = async (req: NextRequest) => {
  try {
    // CORS validation
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin, { allowCredentials: true });

    // allow requests without Origin (server-side) or from allowed origins
    const isServerSide = !origin;
    if (!headers["Access-Control-Allow-Origin"] && !isServerSide) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Invalid origin" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");

    if (!publicTables.has(table || "")) {
      await verifyToken(req, false, true); // Skip CSRF for GET requests
    }

    // Validate query params
    const parsed = validateQueryParams(req, selectQuerySchema);

    const {
      schema,
      table: tableName,
      field,
      from,
      to,
      page,
      pageSize,
      ...rest
    } = parsed;

    const appliesSuspectedCasesGenomicsRules =
      tableName === "suspected_cases" || tableName === "suspected_cases_stats";

    // Keep suspected_cases and suspected_cases_stats aligned on genomics masking/grouping.
    const maskSuspectedCases = appliesSuspectedCasesGenomicsRules
      ? (await getSystemSetting("MASK_SUSPECTED_CASES_GENOMICS_FIELDS")) ===
        "true"
      : false;

    const groupSuspectedCases = appliesSuspectedCasesGenomicsRules
      ? (await getSystemSetting("GROUP_SUSPECTED_CASES_GENOMICS")) === "true"
      : false;

    // Validate date field whitelist
    const dateFilter =
      from || to
        ? {
            field: validateDateField(field) ? field : "created_at",
            from,
            to,
          }
        : undefined;

    // Extra filters (anything not schema/table/field/from/to)
    const filters = rest as Record<string, string>;

    // User group restrictions
    const { groups, roles } = await getUserGroupsFromSession();

    assertSelectTableAccess(roles, tableName);

    // Build the pagination object
    const pagination =
      page && pageSize
        ? {
            page: Number(page),
            pageSize: Number(pageSize),
          }
        : undefined;

    // Inject internal-only flag for masking sensitive fields in suspected_cases
    delete filters.__mask_suspected_cases_genomics;
    delete filters.__group_suspected_cases_genomics;
    filters.__mask_suspected_cases_genomics = maskSuspectedCases
      ? "true"
      : "false";
    filters.__group_suspected_cases_genomics = groupSuspectedCases
      ? "true"
      : "false";

    if (
      tableName === "feedbacks"
      || tableName === "suspected_cases"
      || tableName === "suspected_cases_stats"
    ) {
      const [userEmail] = await getUserEmailFromSession();

      // For the feedbacks table, a session email is optional — anonymous
      // users may browse their own feedback if a matching filter is provided.
      if (!userEmail && tableName !== "feedbacks") {
        throw new Error(
          `Authenticated user email is required to access ${tableName}`,
        );
      }

      if (userEmail) {
        filters.__session_email = userEmail;
      }
    }

    // Fetch table data
    const result = await getTableData(
      schema,
      tableName,
      filters,
      groups,
      dateFilter,
      pagination,
    );

    return successResponse(result);
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const GET = withRateLimit(getHandler);
