import { NextResponse, NextRequest } from "next/server";
import { corsHeaders } from "./lib/cors";
import { EMBED_FRAME_SOURCES } from "./lib/security/csp";
import { publicTables } from "./lib/constants";

type RequestLike = Pick<NextRequest, "method" | "nextUrl">;

function parseTablesList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function shouldBypassApiAuth(req: RequestLike): boolean {
  const { pathname, searchParams } = req.nextUrl;

  if (req.method === "OPTIONS") {
    return true;
  }

  if (pathname === "/api/csrf-token" || pathname === "/api/healthcheck") {
    return true;
  }

  if (req.method !== "GET") {
    return false;
  }

  if (pathname === "/api/select") {
    const table = searchParams.get("table");
    return Boolean(table && publicTables.has(table));
  }

  if (pathname === "/api/select/multiple") {
    const tables = parseTablesList(searchParams.get("tables"));
    return tables.length > 0 && tables.every((table) => publicTables.has(table));
  }

  return false;
}

export default function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (shouldBypassApiAuth(req) && req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    const filteredHeaders = Object.fromEntries(
      Object.entries(headers).filter(([, value]) => value !== undefined),
    ) as Record<string, string>;
    return NextResponse.json({}, { status: 200, headers: filteredHeaders });
  }

  const response = NextResponse.next();

  // Content Security Policy — use Web Crypto (Edge-safe, no Buffer)
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: https:`,
    `connect-src 'self'`,
    `frame-src 'self' ${EMBED_FRAME_SOURCES.join(" ")}`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);

  // CORS headers
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/feedbacks/:path*",
    "/feedbacks",
    "/admin/:path*",
    "/admin",
  ],
};

