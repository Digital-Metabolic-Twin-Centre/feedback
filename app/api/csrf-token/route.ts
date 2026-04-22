import { NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, generateCsrfCookie, CSRF_CONSTANTS } from "@/lib/csrf";
import { verifyToken, handleApiError } from "@/lib/api-helpers";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/csrf-token
 * 
 * Provides CSRF token to authenticated clients
 * The token must be included in the X-CSRF-Token header for all
 * state-changing requests (POST, PUT, PATCH, DELETE)
 */
const getHandler = async (req: NextRequest) => {
  try {
    // CSRF token endpoint is public — no authentication required.
    // The token itself is cryptographically signed and validated per-request.
    await verifyToken(req, true, true);

    // Generate new CSRF token
    const { token, signedToken } = generateCsrfToken();

    // Create response with token
    const response = NextResponse.json({
      token,
      headerName: CSRF_CONSTANTS.HEADER_NAME,
      message: "Include this token in the X-CSRF-Token header for POST/PUT/PATCH/DELETE requests",
    });

    // Set the signed token in an HttpOnly cookie
    response.headers.set("Set-Cookie", generateCsrfCookie(signedToken));

    return response;
  } catch (error) {
    return handleApiError(error, req);
  }
};

export const GET = withRateLimit(getHandler);
