/**
 * API Helper Functions
 *
 * Utility functions for API routes including validation, error handling,
 * and standardized response formatting.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, z } from "zod";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env-validation";
import {
  logError,
  isSecurityCritical,
} from "@/lib/error-logger";
import { validateCsrfToken, requiresCsrfProtection } from "@/lib/csrf";
import { ApiError } from "@/lib/api-error";

const secretKey = env.NEXTAUTH_SECRET;

export { ApiError } from "@/lib/api-error";

/**
 * Validates request body against a Zod schema
 *
 * @param req - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Parsed and validated data
 * @throws ApiError if validation fails
 */
export async function validateRequestBody<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(`Validation failed`, 400);
    }
    throw new ApiError("Invalid request body", 400);
  }
}

/**
 * Validates query parameters against a Zod schema
 *
 * @param req - Next.js request object
 * @param schema - Zod schema for validation
 * @returns Parsed and validated query parameters
 * @throws ApiError if validation fails
 */
export function validateQueryParams<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): z.infer<T> {
  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // const issues = error.issues.map((issue) => ({
      //   path: issue.path.join("."),
      //   message: issue.message,
      // }));
      throw new ApiError(
        `Query validation failed`,
        400
      );
    }
    throw new ApiError("Invalid query parameters", 400);
  }
}

/**
 * Verifies JWT token and CSRF token from request
 *
 * @param req - Next.js request object
 * @param allowPublic - Allow access without token (default: false)
 * @param skipCsrf - Skip CSRF validation (default: false, for GET requests)
 * @returns Token object if authenticated, null if allowPublic and no token
 * @throws ApiError if authentication or CSRF validation fails
 */
export async function verifyToken(
  req: NextRequest,
  allowPublic: boolean = false,
  skipCsrf: boolean = false
) {
  // Validate CSRF token for state-changing operations
  if (!skipCsrf && requiresCsrfProtection(req.method)) {
    await validateCsrfToken(req);
  }

  const token = await getToken({ req, secret: secretKey });

  if (!token && !allowPublic) {
    throw new ApiError("Unauthorized: No valid token", 401, "/unauthorized?reason=no-permissions");
  }

  if (!token) return null;

  if (token?.exp && Date.now() >= (token.exp as number) * 1000) {
    throw new ApiError("Session expired", 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decoded = token.decoded as any;

  return {
    userId: token.sub as string,
    email: token.email as string | undefined,
    roles: decoded?.client_roles ?? [],
    realmRoles: decoded?.realm_access?.roles ?? [],
    groups: decoded?.groups ?? [],

    token,
  };
}

/**
 * Standardized error handler for API routes
 *
 * @param error - Error object
 * @param req - Next.js request object
 * @returns NextResponse with appropriate error status and message
 */
export function handleApiError(error: unknown, req: NextRequest): NextResponse {
  const severity = isSecurityCritical(error) ? "critical" : "error";

  // Log full structured error
  logError(
    error,
    {
      operation: "API Request",
      resource: req.url,
      metadata: { method: req.method },
    },
    severity
  );

  // Handle known ApiError instances
  if (error instanceof ApiError) {
    if (error.redirectUrl) {
      // Get the proper host from request headers
      const baseUrl =
        env.NEXT_PUBLIC_APP_URL ||
        `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`;


      return NextResponse.redirect(new URL(error.redirectUrl, baseUrl));
    }
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "Validation failed",
        errors: error.issues,
      },
      { status: 400 }
    );
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("API Error:", message, error);

  return NextResponse.json(
    {
      success: false,
      message: "Internal server error",
    },
    { status: 500 }
  );
}

/**
 * Success response helper
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with success data
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function successResponse<T extends Record<string, any>>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

/**
 * Extract and validate filters from query parameters
 *
 * @param searchParams - URLSearchParams from request
 * @param excludeKeys - Keys to exclude from filters
 * @returns Record of filter key-value pairs
 */
export function extractFilters(
  searchParams: URLSearchParams,
  excludeKeys: string[] = []
): Record<string, string> {
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (!excludeKeys.includes(key)) {
      filters[key] = value;
    }
  });
  return filters;
}
