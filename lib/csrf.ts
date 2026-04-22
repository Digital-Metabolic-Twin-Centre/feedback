/**
 * CSRF Protection Implementation
 * 
 * Double Submit Cookie pattern with HMAC signing
 * Provides protection against Cross-Site Request Forgery attacks
 */

import { createHmac, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { env } from "./env-validation";
import { ApiError } from "./api-error";

const CSRF_SECRET = env.NEXTAUTH_SECRET;
const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf_token";

/**
 * Generate a cryptographically secure CSRF token
 * Returns both the plain token and signed token
 */
export function generateCsrfToken(): { token: string; signedToken: string } {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
  const signature = signToken(token);

  return {
    token,
    signedToken: `${token}.${signature}`,
  };
}

/**
 * Sign a token using HMAC-SHA256
 */
function signToken(token: string): string {
  const hmac = createHmac("sha256", CSRF_SECRET);
  hmac.update(token);
  return hmac.digest("hex");
}

/**
 * Verify that a token matches its signature
 */
function verifyTokenSignature(token: string, signature: string): boolean {
  const expectedSignature = signToken(token);
  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Extract CSRF token from request headers
 */
function getTokenFromHeader(req: NextRequest): string | null {
  return req.headers.get(CSRF_HEADER_NAME) ||
    req.headers.get(CSRF_HEADER_NAME.toLowerCase());
}

/**
 * Extract CSRF token from cookies
 */
function getTokenFromCookie(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map(c => c.trim());
  const csrfCookie = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!csrfCookie) return null;

  return csrfCookie.split("=")[1];
}

/**
 * Validate CSRF token using Double Submit Cookie pattern
 * 
 * @param req - Next.js request object
 * @throws ApiError if validation fails
 */
export async function validateCsrfToken(req: NextRequest): Promise<void> {
  const headerToken = getTokenFromHeader(req);
  const cookieToken = getTokenFromCookie(req);

  if (!headerToken || !cookieToken) {
    throw new ApiError("CSRF token missing", 403);
  }

  const [cookieTokenValue, signature] = cookieToken.split(".");

  if (!cookieTokenValue || !signature) {
    throw new ApiError("CSRF token malformed", 403);
  }

  if (headerToken !== cookieTokenValue) {
    throw new ApiError("CSRF token mismatch", 403);
  }

  if (!verifyTokenSignature(cookieTokenValue, signature)) {
    throw new ApiError("CSRF token invalid", 403);
  }
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  if (!method) return false;
  const protectedMethods = ["POST", "PUT", "PATCH", "DELETE"];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * Generate cookie header string for CSRF token
 */
export function generateCsrfCookie(signedToken: string): string {
  const maxAge = 60 * 60; // 1 hour
  const sameSite = "lax"; // Prevent CSRF while allowing normal navigation
  const secure = env.NODE_ENV === "production"; // HTTPS only in production

  return `${CSRF_COOKIE_NAME}=${signedToken}; Path=/; Max-Age=${maxAge}; SameSite=${sameSite}${secure ? "; Secure" : ""}; HttpOnly`;
}

/**
 * Get or generate CSRF token for a request
 * Used in API routes that need to provide a token
 */
export function getCsrfToken(req: NextRequest): { token: string; signedToken: string } {
  const existingSignedToken = getTokenFromCookie(req);

  if (existingSignedToken) {
    // reuse existing signed token
    return {
      token: "", // client already has token
      signedToken: existingSignedToken,
    };
  }

  return generateCsrfToken();
}

/**
 * Constants for export
 */
export const CSRF_CONSTANTS = {
  HEADER_NAME: CSRF_HEADER_NAME,
  COOKIE_NAME: CSRF_COOKIE_NAME,
} as const;
