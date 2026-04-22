"use server";

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-helpers";
import { env } from "@/lib/env-validation";
import { withRateLimit } from "@/lib/rate-limit";

function clearCookieEverywhere(response: NextResponse, name: string) {
  const baseOptions = {
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  } as const;

  response.cookies.set(name, "", baseOptions);

  if (env.NODE_ENV === "production") {
    response.cookies.set(name, "", {
      ...baseOptions,
      secure: true,
      sameSite: "lax",
    });
  }

  const cookieDomain = env.COOKIE_DOMAIN?.trim();
  if (cookieDomain && !name.startsWith("__Host-")) {
    response.cookies.set(name, "", {
      ...baseOptions,
      domain: cookieDomain,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
}

function clearAuthCookies(response: NextResponse) {
  const cookies = [
    "next-auth.session-token",
    "next-auth.session-token.0",
    "next-auth.session-token.1",
    "next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
  ];

  cookies.forEach((name) => clearCookieEverywhere(response, name));
}

const getHandler = async (req: NextRequest) => {
  try {
    const appUrl = env.NEXTAUTH_URL ?? new URL(req.url).origin;
    const response = NextResponse.redirect(appUrl);
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleApiError(error, req);
  }
};

export const GET = withRateLimit(getHandler);
