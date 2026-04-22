jest.mock("next-auth/middleware", () => ({
  withAuth: jest.fn((handler) => handler),
}));

jest.mock("@/lib/env-validation", () => ({
  env: {
    NODE_ENV: "test",
  },
}));

jest.mock("@/lib/permissions", () => ({
  SITE_PERMISSIONS: {},
}));

jest.mock("@/lib/urls", () => ({
  SITE_PATHS: {},
}));

jest.mock("@/lib/cors", () => ({
  corsHeaders: jest.fn(() => ({})),
}));

jest.mock("@/lib/auth-audit", () => ({
  auditAuthEvent: jest.fn(),
}));

import { shouldBypassApiAuth } from "@/proxy";

function createMockRequest(url: string, method: string = "GET") {
  const nextUrl = new URL(url);

  return {
    method,
    nextUrl: {
      pathname: nextUrl.pathname,
      searchParams: nextUrl.searchParams,
    },
  } as never;
}

describe("shouldBypassApiAuth", () => {
  it("allows unauthenticated access to the CSRF token route", () => {
    const request = createMockRequest("http://localhost:3000/api/csrf-token");

    expect(shouldBypassApiAuth(request)).toBe(true);
  });

  it("allows unauthenticated access to the public healthcheck route", () => {
    const request = createMockRequest("http://localhost:3000/api/healthcheck");

    expect(shouldBypassApiAuth(request)).toBe(true);
  });

  it("allows public GET /api/select requests for public tables", () => {
    const request = createMockRequest(
      "http://localhost:3000/api/select?table=study_site_status",
    );

    expect(shouldBypassApiAuth(request)).toBe(true);
  });

  it("allows public GET /api/select/multiple requests when all tables are public", () => {
    const request = createMockRequest(
      "http://localhost:3000/api/select/multiple?tables=study_site_status,shipping_template",
    );

    expect(shouldBypassApiAuth(request)).toBe(true);
  });

  it("does not bypass auth for protected API routes", () => {
    const request = createMockRequest(
      "http://localhost:3000/api/create",
      "POST",
    );

    expect(shouldBypassApiAuth(request)).toBe(false);
  });

  it("allows unauthenticated OPTIONS requests to reach proxy CORS handling", () => {
    const request = createMockRequest(
      "http://localhost:3000/api/create",
      "OPTIONS",
    );

    expect(shouldBypassApiAuth(request)).toBe(true);
  });
});
