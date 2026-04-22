import { NextResponse, NextRequest } from "next/server";
import { corsHeaders } from "./lib/cors";
import { EMBED_FRAME_SOURCES } from "./lib/security/csp";

export default function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
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


