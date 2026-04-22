/**
 * API Route: /api/select/multiple
 *
 * Select statement for tables with multiple foreign keys.
 * Allows querying several tables in a single request,
 * ensuring only one round-trip to the database per table.
 * Useful for loading dropdown options or reference data efficiently.
 */

import { NextRequest } from "next/server";
import { publicTables } from "@/lib/constants";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { getForeignTableData } from "@/app/actions/select/foreign/action";
import {
  validateQueryParams,
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { corsHeaders } from "@/lib/cors";

import { selectMultipleQuerySchema } from "@/lib/api-validation";
import { assertSelectTableAccess } from "@/lib/api-table-authorization";
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const tablesParam = searchParams.get("tables");

    // Public tables that don't require authentication

    // Check if any requested table is public
    const requestedTables = tablesParam?.split(",").map((t) => t.trim()) || [];
    const allTablesPublic = requestedTables.every((t) => publicTables.has(t));

    // Only require authentication if requesting non-public tables
    if (!allTablesPublic) {
      await verifyToken(req, false, true); // Skip CSRF for GET requests
    }

    // Validate query params
    const { schema, tables } = validateQueryParams(
      req,
      selectMultipleQuerySchema,
    );

    // Extract filters (anything that isn't schema/tables/contact flag)
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!["tables", "schema"].includes(key)) {
        filters[key] = value;
      }
    });

    // Resolve user groups (empty for public access)
    const { groups, roles } = allTablesPublic
      ? { groups: [], roles: [] as string[] }
      : await getUserGroupsFromSession();

    // Query each table
    const data: Record<string, unknown[]> = {};
    const tableList = tables.split(",").map((t) => t.trim());

    for (const table of tableList) {
      assertSelectTableAccess(roles, table);
      const result = await getForeignTableData(schema, table, groups, filters);
      if (!result.success) {
        return handleApiError(new Error(`Failed to load ${table}`), req);
      }
      data[table] = result.data;
    }

    return successResponse({ data });
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const GET = withRateLimit(getHandler);
