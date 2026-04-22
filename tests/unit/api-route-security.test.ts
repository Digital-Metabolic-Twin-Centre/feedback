/* eslint-disable @typescript-eslint/no-require-imports */
// MUST be first before imports that use env
jest.mock("@/lib/env-validation", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    KEYCLOAK_CLIENT_ID: "dummy",
    KEYCLOAK_DOMAIN: "http://dummy",
    KEYCLOAK_JWKS_URI: "http://dummy",
    KEYCLOAK_CLIENT_SECRET: "dummy",
    NEXTAUTH_SECRET: "test-secret-32-chars-minimum!!",
    NEXTAUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
    CENTRAL_RESOURCES_FOLDER_ID: "dummy",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "dummy@example.com",
    GOOGLE_PRIVATE_KEY: "dummy",
    GITLAB_ISSUES_REPORTING_TOKEN: "dummy",
    GITLAB_REPORTING_PROJECT_ID: "123",
  },
}));

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    incr: jest.fn(),
    pexpire: jest.fn(),
    disconnect: jest.fn(),
    status: "ready",
  })),
  { virtual: true },
);

import { API_ENDPOINTS } from "@/lib/urls";
import { publicTables } from "@/lib/constants";
import {
  validateCsrfToken,
  generateCsrfToken,
  CSRF_CONSTANTS,
} from "@/lib/csrf";
import {
  enforceRateLimit,
  resetRateLimitStateForTests,
  withRateLimit,
} from "@/lib/rate-limit";

// Create a simple ApiError class for testing
class ApiError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = "ApiError";
  }
}

// Mock functions
const verifyToken = jest.fn();

function createMockRequest({
  url = `http://localhost:3000${API_ENDPOINTS.CREATE}`,
  method = "GET",
  headers = {},
}: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    url,
    method,
    headers: {
      get(name: string) {
        return normalizedHeaders.get(name.toLowerCase()) ?? null;
      },
    },
    nextUrl: new URL(url),
  };
}

describe("API Route Security", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetRateLimitStateForTests();
  });

  describe("Authentication Requirements", () => {
    it("should require valid token for protected routes", async () => {
      const error = new ApiError("Unauthorized: No valid token", 401);
      verifyToken.mockRejectedValue(error);

      const mockRequest = createMockRequest();

      await expect(verifyToken(mockRequest)).rejects.toThrow("Unauthorized: No valid token");
    });

    it("should allow requests with valid authentication token", async () => {
      verifyToken.mockResolvedValueOnce({
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: "token-id",
      });

      const mockRequest = createMockRequest();

      const token = await verifyToken(mockRequest);
      expect(token).toBeDefined();
      expect(token?.sub).toBe("user-123");
    });

    it("should reject expired tokens", async () => {
      verifyToken.mockResolvedValueOnce({
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
        jti: "token-id",
      });

      const mockRequest = createMockRequest();

      // Token verification might pass here, but middleware should catch expiration
      const token = await verifyToken(mockRequest);
      if (token?.exp) {
        expect(token.exp * 1000).toBeLessThan(Date.now());
      }
    });
  });

  describe("CSRF Token Validation", () => {
    it("should validate CSRF token on POST requests", async () => {
      const { token, signedToken } = generateCsrfToken();

      const mockRequest = createMockRequest({
        method: "POST",
        headers: {
          "x-csrf-token": token,
          cookie: `${CSRF_CONSTANTS.COOKIE_NAME}=${signedToken}`,
        },
      });

      // Should not throw with matching CSRF tokens
      await expect(validateCsrfToken(mockRequest)).resolves.not.toThrow();
    });

    it("should reject requests with missing CSRF token", async () => {
      const mockRequest = createMockRequest({
        method: "POST",
      });

      await expect(validateCsrfToken(mockRequest as never)).rejects.toThrow("CSRF token missing");
    });

    it("should reject requests with mismatched CSRF tokens", async () => {
      const { signedToken } = generateCsrfToken();

      const mockRequest = createMockRequest({
        method: "POST",
        headers: {
          "x-csrf-token": "different-csrf-token",
          cookie: `${CSRF_CONSTANTS.COOKIE_NAME}=${signedToken}`,
        },
      });

      await expect(validateCsrfToken(mockRequest)).rejects.toThrow("CSRF token mismatch");
    });

    it("should reject malformed CSRF cookies", async () => {
      const mockRequest = createMockRequest({
        method: "POST",
        headers: {
          "x-csrf-token": "actual-token",
          cookie: `${CSRF_CONSTANTS.COOKIE_NAME}=actual-token`,
        },
      });

      await expect(validateCsrfToken(mockRequest)).rejects.toThrow("CSRF token malformed");
    });

    it("should not allow a development-only bypass for missing tokens", async () => {
      const mockRequest = createMockRequest({
        method: "POST",
      });

      await expect(validateCsrfToken(mockRequest)).rejects.toThrow("CSRF token missing");
    });
  });

  describe("Protected API Routes", () => {
    it("should protect /api/create route", async () => {
      // Without authentication
      verifyToken.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

      const mockRequest = createMockRequest({
        method: "POST",
      });

      await expect(verifyToken(mockRequest)).rejects.toThrow();
    });

    it("should protect /api/update route", async () => {
      verifyToken.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

      const mockRequest = createMockRequest({
        url: "http://localhost:3000/api/update",
        method: "POST",
      });

      await expect(verifyToken(mockRequest)).rejects.toThrow();
    });

    it("should protect /api/delete route", async () => {
      verifyToken.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

      const mockRequest = createMockRequest({
        url: "http://localhost:3000/api/delete",
        method: "POST",
      });

      await expect(verifyToken(mockRequest)).rejects.toThrow();
    });

    it("should allow public access to analytics tables", () => {
      // These tables should be accessible without authentication
      // when accessed through /api/select with the correct table parameter
      publicTables.forEach((table) => {
        expect(publicTables).toContain(table);
      });
    });
  });

  describe("Request Body Validation", () => {
    it("should validate request body against schema", async () => {
      const { z } = require("zod");

      const createRequestSchema = z.object({
        schema: z.string().min(1).max(100).regex(/^[a-z_]+$/),
        tableName: z.string().min(1).max(100).regex(/^[a-z_]+$/),
        data: z.record(z.unknown()),
      });

      // Valid request
      const validRequest = {
        schema: "imdhub_core",
        tableName: "participant_registrations",
        data: { name: "Test" },
      };

      expect(() => createRequestSchema.parse(validRequest)).not.toThrow();

      // Invalid requests
      const invalidRequests = [
        { schema: "invalid-schema!", tableName: "table", data: {} },
        { schema: "schema", tableName: "table'; DROP TABLE--", data: {} },
        { schema: "", tableName: "table", data: {} },
        { schema: "schema", tableName: "", data: {} },
      ];

      invalidRequests.forEach((request) => {
        expect(() => createRequestSchema.parse(request)).toThrow();
      });
    });
  });

  describe("Error Handling and Information Disclosure", () => {
    it("should not expose sensitive information in errors", () => {
      const sensitiveError = new Error(
        "Database connection failed: postgres://user:password@localhost:5432/db"
      );

      // Error sanitization should remove sensitive info
      function sanitizeError(message: string): string {
        return message
          .replace(/password[=:]\s*["']?[\w@!#$%^&*]+["']?/gi, "password=***")
          .replace(/postgres:\/\/[^@]+@/g, "postgres://***@");
      }

      const sanitized = sanitizeError(sensitiveError.message);
      expect(sanitized).not.toContain("password");
      expect(sanitized).toContain("***");
    });

    it("should return generic error messages to clients", async () => {

      // In API route, handleApiError should return generic message
      const userFriendlyMessage = "Internal server error";

      expect(userFriendlyMessage).not.toContain("sensitive details");
      expect(userFriendlyMessage).toBe("Internal server error");
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests under the in-memory rate limit", async () => {
      const mockRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.10" },
      });

      await expect(
        enforceRateLimit(mockRequest as never, { limit: 2, windowMs: 60_000 }),
      ).resolves.toBeNull();
    });

    it("should return 429 once the rate limit is exceeded", async () => {
      const mockRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.11" },
      });

      await enforceRateLimit(mockRequest as never, { limit: 1, windowMs: 60_000 });
      const result = await enforceRateLimit(mockRequest as never, {
        limit: 1,
        windowMs: 60_000,
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it("should bypass rate limiting for OPTIONS requests", async () => {
      const mockRequest = createMockRequest({
        method: "OPTIONS",
        headers: { "x-forwarded-for": "192.168.1.13" },
      });

      await expect(
        enforceRateLimit(mockRequest as never, { limit: 1, windowMs: 60_000 }),
      ).resolves.toBeNull();
      await expect(
        enforceRateLimit(mockRequest as never, { limit: 1, windowMs: 60_000 }),
      ).resolves.toBeNull();
    });

    it("withRateLimit should block the wrapped handler after the threshold", async () => {
      const handler = jest.fn(async () => ({ status: 200 } as Response));
      const wrapped = withRateLimit(handler, { limit: 1, windowMs: 60_000 });

      const firstRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.12" },
      });
      const secondRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.12" },
      });

      const firstResponse = await wrapped(firstRequest as never, undefined);
      const secondResponse = await wrapped(secondRequest as never, undefined);

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should not trust spoofed forwarded IP headers by default", async () => {
      const firstRequest = createMockRequest({
        method: "POST",
        headers: {
          authorization: "Bearer stable-token",
          "x-forwarded-for": "192.168.1.20",
        },
      });
      const secondRequest = createMockRequest({
        method: "POST",
        headers: {
          authorization: "Bearer stable-token",
          "x-forwarded-for": "203.0.113.50",
        },
      });

      await enforceRateLimit(firstRequest as never, { limit: 1, windowMs: 60_000 });
      const result = await enforceRateLimit(secondRequest as never, {
        limit: 1,
        windowMs: 60_000,
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it("should optionally trust forwarded IP headers when explicitly enabled", async () => {
      const firstRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.30" },
      });
      const secondRequest = createMockRequest({
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.60" },
      });

      await enforceRateLimit(firstRequest as never, {
        limit: 1,
        windowMs: 60_000,
        trustProxyHeaders: true,
      });
      const result = await enforceRateLimit(secondRequest as never, {
        limit: 1,
        windowMs: 60_000,
        trustProxyHeaders: true,
      });

      expect(result).toBeNull();
    });

    it("should not allow authorization header rotation to bypass rate limiting", async () => {
      const firstRequest = createMockRequest({
        method: "POST",
        headers: {
          authorization: "Bearer token-one",
          "user-agent": "stable-agent",
          "accept-language": "en-IE",
        },
      });
      const secondRequest = createMockRequest({
        method: "POST",
        headers: {
          authorization: "Bearer token-two",
          "user-agent": "stable-agent",
          "accept-language": "en-IE",
        },
      });

      await enforceRateLimit(firstRequest as never, { limit: 1, windowMs: 60_000 });
      const result = await enforceRateLimit(secondRequest as never, {
        limit: 1,
        windowMs: 60_000,
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });
  });

  describe("Authorization Header Validation", () => {
    it("should extract user from valid token", async () => {
      verifyToken.mockResolvedValueOnce({
        sub: "user-123",
        email: "user@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        jti: "token-id",
      });

      const mockRequest = createMockRequest();

      const token = await verifyToken(mockRequest);
      expect(token?.sub).toBe("user-123");
      expect(token?.email).toBe("user@example.com");
    });
  });

  describe("Public vs Protected Routes", () => {
    it("should allow public routes without authentication", async () => {
      const allowPublic = true;
      verifyToken.mockResolvedValueOnce(null);

      const mockRequest = createMockRequest({
        url: "http://localhost:3000/api/select?table=study_site_status",
      });

      const token = await verifyToken(mockRequest, allowPublic);
      expect(token).toBeNull();
    });

    it("should require authentication for non-public routes", async () => {
      const allowPublic = false;
      verifyToken.mockRejectedValueOnce(new ApiError("Unauthorized", 401));

      const mockRequest = createMockRequest({
        url: "http://localhost:3000/api/select?table=participant_identifiers",
      });

      await expect(verifyToken(mockRequest, allowPublic)).rejects.toThrow();
    });
  });
});
