import { withAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";
import { NextResponse, NextRequest } from "next/server";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { corsHeaders } from "./lib/cors";
import { env } from "./lib/env-validation";
import { auditAuthEvent } from "./lib/auth-audit";
import { publicTables } from "./lib/constants";
import { EMBED_FRAME_SOURCES } from "./lib/security/csp";

/**
 * Validate the access token with Keycloak
 * @param accessToken The access token to validate
 * @returns True if the token is valid, false otherwise
 */

// Define required roles for specific paths
const ROLE_REQUIREMENTS: Record<string, string[]> = {
  "/admin": [SITE_PERMISSIONS.CAN_ACCESS_ADMIN],
  "/feedbacks": [SITE_PERMISSIONS.CAN_VIEW],
};

// Validate token with Keycloak using introspection endpoint
// Clear session cookies
function clearSessionCookies(response: NextResponse) {
  const cookies = [
    "next-auth.session-token",
    "next-auth.session-token.0",
    "next-auth.session-token.1",
    "next-auth.csrf-token",
    "__Secure-next-auth.session-token",
    "__Host-next-auth.csrf-token",
  ];

  cookies.forEach((name) => {
    response.cookies.delete(name);
  });
}

// Helper function
function forceLogout(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/?auth=required", req.url));
  clearSessionCookies(response);

  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) response.headers.set(key, value);
  });

  return response;
}
// use for audit loggin when the token is missing or invalid
function getEmailFromToken(token: {
  email: string;
  decoded: { email: string };
  preferred_username: string;
}) {
  return (
    token?.email ??
    token?.decoded?.email ??
    token?.preferred_username ??
    "unknown@imdhub-system"
  );
}

function getKeycloakSessionIdFromToken(token: {
  sid?: string;
}): string | undefined {
  return token?.sid;
}

export function shouldBypassApiAuth(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (req.method === "OPTIONS") {
    return true;
  }

  // Let these routes enforce their own public/auth behavior in the handler.
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/healthcheck" ||
    pathname === "/api/csrf-token"
  ) {
    return true;
  }

  if (pathname === "/api/select" && req.method === "GET") {
    const table = req.nextUrl.searchParams.get("table");
    return typeof table === "string" && publicTables.has(table);
  }

  if (pathname === "/api/select/multiple" && req.method === "GET") {
    const tablesParam = req.nextUrl.searchParams.get("tables");
    const requestedTables =
      tablesParam?.split(",").map((table) => table.trim()).filter(Boolean) ?? [];

    return (
      requestedTables.length > 0 &&
      requestedTables.every((table) => publicTables.has(table))
    );
  }

  return false;
}

async function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");
  const pathname = req.nextUrl.pathname;

  if (shouldBypassApiAuth(req)) {
    return NextResponse.next();
  }

  // Generate unique nonce per request using Web Crypto API
  const nonceBuffer = new Uint8Array(16);
  crypto.getRandomValues(nonceBuffer);
  const nonce = Buffer.from(nonceBuffer).toString("base64");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    const filteredHeaders = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(headers).filter(([_, value]) => value !== undefined),
    ) as Record<string, string>;
    return NextResponse.json(
      {},
      {
        status: 200,
        headers: filteredHeaders,
      },
    );
  }

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (req as any).nextauth?.token;
  if (!token) {
    return forceLogout(req);
  }

  // Check token expiration using the exp claim stored in the JWT cookie
  const tokenExp = token.exp as number | undefined;
  if (tokenExp && tokenExp * 1000 < Date.now()) {
    await auditAuthEvent({
      event: "SESSION_EXPIRED",
      email: getEmailFromToken(token),
      sessionId: getKeycloakSessionIdFromToken(token),
    });
    return forceLogout(req);
  }

  // Use pre-decoded roles and groups cached in the JWT (avoids storing the raw
  // access_token in the cookie which causes cookie-size overflow).
  const roles = (token.roles as string[] | undefined) ?? [];
  const groups = (token.groups as string[] | undefined) ?? [];
  if (groups.length === 0 || roles.length === 0) {
    const response = NextResponse.redirect(
      new URL("/unauthorized?reason=no-permissions", req.url),
    );
    // Add CORS headers
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }
  // prevent non testers from access demo site or from accessing the main site in maintenance mode
  if (process.env.MAINTENANCE_MODE === "true") {
    if (!roles.includes(SITE_PERMISSIONS.CAN_ACCESS_MAINTENANCE_MODE)) {
      const response = NextResponse.redirect(
        new URL("/unauthorized?reason=maintenance-access", req.url),
      );

      // Add CORS headers
      const headers = corsHeaders(origin);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
  }

  // Match the requested path against ROLE_REQUIREMENTS
  // const pathname = req.nextUrl.pathname;

  // Sort role requirements so longer prefixes are checked first
  const sortedRequirements = Object.entries(ROLE_REQUIREMENTS).sort(
    ([a], [b]) => b.length - a.length,
  );

  for (const [prefix, requiredRoles] of sortedRequirements) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const hasRequiredRole = requiredRoles.some((r) => roles.includes(r));
      if (!hasRequiredRole) {
        const response = NextResponse.redirect(
          new URL("/unauthorized?reason=insufficient-role", req.url),
        );
        // Add CORS headers
        const headers = corsHeaders(origin);
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
      break; // stop after the first match
    }
  }

  const response = NextResponse.next();

  // Set CSP with nonce
  const isDevelopment = env.NODE_ENV === "development";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: https:`,
    `connect-src 'self'`,
    `frame-src 'self' ${EMBED_FRAME_SOURCES.join(" ")}`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);

  // Add CORS headers to successful response
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export default withAuth(proxy, {
  pages: {
    signIn: "/?auth=required",
  },
  callbacks: {
    authorized: ({ req, token }: { req: NextRequest; token: JWT | null }) => {
      if (shouldBypassApiAuth(req)) return true;

      // otherwise require a valid token
      if (!token) return false;
      // hard expiry check using the exp claim stored in the JWT cookie
      if (token.exp && (token.exp as number) * 1000 < Date.now()) {
        return false;
      }
      return true;
    },
  },
});

/***
 * TO BE TREATED WITH CAREFUL CONSIDERATION
 * This configuration defines which paths are protected by the middleware.
 * Modifying these paths can impact application security and access control.
 * Ensure that any changes align with the intended security policies.
 */
export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/feedbacks/:path*",
  ],
};
