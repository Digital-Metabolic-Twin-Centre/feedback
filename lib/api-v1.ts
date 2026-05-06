import { NextRequest, NextResponse } from "next/server";
import type { ApiKeyAuthContext } from "@/lib/api-keys";
import { env } from "@/lib/env-validation";

export function v1CorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-bootstrap-token",
    "Access-Control-Max-Age": "86400",
  };
}

export function v1PreflightResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: v1CorsHeaders(),
  });
}

export function v1Json(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: v1CorsHeaders(),
  });
}

export function authorizeBootstrap(req: NextRequest): NextResponse | null {
  const configuredToken = env.FEEDBACK_BOOTSTRAP_TOKEN;
  if (!configuredToken) {
    return v1Json(
      { success: false, error: "FEEDBACK_BOOTSTRAP_TOKEN is not configured." },
      { status: 503 }
    );
  }

  const provided = req.headers.get("x-bootstrap-token") || "";
  if (provided !== configuredToken) {
    return v1Json({ success: false, error: "Invalid bootstrap token." }, { status: 403 });
  }

  return null;
}

export async function authenticateApiKey(req: NextRequest): Promise<
  | { ok: true; auth: ApiKeyAuthContext }
  | { ok: false; response: NextResponse }
> {
  const { validateApiKey } = await import("@/lib/api-keys");
  const headerKey = req.headers.get("x-api-key") || "";
  const auth = validateApiKey(headerKey);

  if (!auth) {
    return {
      ok: false,
      response: v1Json({ success: false, error: "Invalid or missing API key." }, { status: 401 }),
    };
  }

  return { ok: true, auth };
}

export function requireAdmin(auth: ApiKeyAuthContext): NextResponse | null {
  if (auth.isAdmin) return null;
  return v1Json({ success: false, error: "Admin API key is required." }, { status: 403 });
}
