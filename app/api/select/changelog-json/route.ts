/**
 * API Route: /api/select/changelog-json
 *
 * Purpose:
 * Fetches only changes fields for specific changelog IDs
 * Used for lazy loading heavy JSON columns
 */

import { NextRequest } from "next/server";
import { pgPool } from "@/lib/db";
import {
  verifyToken,
  handleApiError,
  successResponse,
} from "@/lib/api-helpers";
import { corsHeaders } from "@/lib/cors";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { withRateLimit } from "@/lib/rate-limit";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, { allowCredentials: true });
  return new Response(null, { status: 204, headers });
}

async function handleHydrationRequest(
  req: NextRequest,
  idArray: number[]
) {
  const client = await pgPool.connect();

  try {
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin, { allowCredentials: true });
    const isServerSide = !origin;
    const { roles } = await getUserGroupsFromSession();

    if (!headers["Access-Control-Allow-Origin"] && !isServerSide) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Invalid origin" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    await verifyToken(req, false, true); // Skip CSRF for GET requests

    if (
      !roles.includes(SITE_PERMISSIONS.CAN_ACCESS_ADMIN) &&
      !roles.includes(SITE_PERMISSIONS.CAN_VIEW_AUDIT_LOGS)
    ) {
      return new Response(
        JSON.stringify({ success: false, message: "Insufficient permissions" }),
        { status: 403 }
      );
    }

    if (idArray.length === 0 || idArray.length > 10000) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Must provide between 1 and 10000 IDs",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch only JSON fields for specified IDs
    const placeholders = idArray.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `
      SELECT id, changes
      FROM imdhub_logs.v_ref_changelog
      WHERE id IN (${placeholders})
    `;

    const result = await client.query(sql, idArray);

    return successResponse({ success: true, data: result.rows });
  } catch (err) {
    return handleApiError(err, req);
  } finally {
    client.release();
  }
}

const getHandler = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids");

    if (!ids) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing ids parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse and validate IDs
    const idArray = ids.split(",").map((id) => {
      const parsed = parseInt(id.trim(), 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid ID: ${id}`);
      }
      return parsed;
    });

    return handleHydrationRequest(req, idArray);
  } catch (err) {
    return handleApiError(err, req);
  }
};

const postHandler = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids)) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing or invalid ids array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate IDs
    const idArray = ids.map((id) => {
      const parsed = typeof id === "number" ? id : parseInt(id, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid ID: ${id}`);
      }
      return parsed;
    });

    return handleHydrationRequest(req, idArray);
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const GET = withRateLimit(getHandler);
export const POST = withRateLimit(postHandler);
