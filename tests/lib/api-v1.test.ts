import { NextRequest } from "next/server";
import {
  v1CorsHeaders,
  v1PreflightResponse,
  v1Json,
  authorizeBootstrap,
  requireAdmin,
} from "@/lib/api-v1";
import type { ApiKeyAuthContext } from "@/lib/api-keys";

describe("api-v1", () => {
  describe("v1CorsHeaders", () => {
    test("returns CORS headers", () => {
      const headers = v1CorsHeaders();

      expect(headers).toHaveProperty("Access-Control-Allow-Origin", "*");
      expect(headers).toHaveProperty("Access-Control-Allow-Methods");
      expect(headers).toHaveProperty("Access-Control-Allow-Headers");
      expect(headers).toHaveProperty("Access-Control-Max-Age");
    });

    test("allows all origins", () => {
      const headers = v1CorsHeaders();
      expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    });

    test("allows required HTTP methods", () => {
      const headers = v1CorsHeaders();
      const methods = headers["Access-Control-Allow-Methods"].split(",");

      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods).toContain("PATCH");
      expect(methods).toContain("DELETE");
      expect(methods).toContain("OPTIONS");
    });

    test("allows required headers", () => {
      const headers = v1CorsHeaders();
      const allowedHeaders = headers["Access-Control-Allow-Headers"].toLowerCase();

      expect(allowedHeaders).toContain("content-type");
      expect(allowedHeaders).toContain("authorization");
      expect(allowedHeaders).toContain("x-api-key");
      expect(allowedHeaders).toContain("x-bootstrap-token");
    });

    test("sets cache age", () => {
      const headers = v1CorsHeaders();
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });

  describe("v1PreflightResponse", () => {
    test("returns 204 No Content response", () => {
      const response = v1PreflightResponse();

      expect(response.status).toBe(204);
    });

    test("includes CORS headers", () => {
      const response = v1PreflightResponse();

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    });

    test("returns empty body", async () => {
      const response = v1PreflightResponse();
      const text = await response.text();

      expect(text).toBe("");
    });
  });

  describe("v1Json", () => {
    test("returns JSON response with default 200 status", () => {
      const data = { success: true, message: "test" };
      const response = v1Json(data);

      expect(response.status).toBe(200);
    });

    test("sets correct content type", () => {
      const response = v1Json({ test: "data" });

      expect(response.headers.get("content-type")).toContain("application/json");
    });

    test("includes CORS headers", () => {
      const response = v1Json({ test: "data" });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    test("allows custom status code", () => {
      const response = v1Json({ error: "Not found" }, { status: 404 });

      expect(response.status).toBe(404);
    });

    test("serializes data to JSON", async () => {
      const data = { key: "value", number: 42, nested: { prop: "test" } };
      const response = v1Json(data);
      const body = await response.json();

      expect(body).toEqual(data);
    });

    test("handles different status codes", () => {
      expect(v1Json({}, { status: 201 }).status).toBe(201);
      expect(v1Json({}, { status: 400 }).status).toBe(400);
      expect(v1Json({}, { status: 500 }).status).toBe(500);
    });

    test("handles various data types", async () => {
      const testCases = [
        { data: null, expected: null },
        { data: true, expected: true },
        { data: "string", expected: "string" },
        { data: 123, expected: 123 },
        { data: [], expected: [] },
      ];

      for (const testCase of testCases) {
        const response = v1Json(testCase.data);
        const body = await response.json();
        expect(body).toEqual(testCase.expected);
      }
    });
  });

  describe("authorizeBootstrap", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.FEEDBACK_BOOTSTRAP_TOKEN = "valid-token-123456";
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test("returns null when token is valid", () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "valid-token-123456" },
      });

      const result = authorizeBootstrap(req);

      expect(result).toBeNull();
    });

    test("returns error response when token is invalid", () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "wrong-token" },
      });

      const result = authorizeBootstrap(req);

      expect(result?.status).toBe(403);
    });

    test("returns error response when token is missing", () => {
      const req = new NextRequest("http://localhost");

      const result = authorizeBootstrap(req);

      expect(result?.status).toBe(403);
    });

    test("returns 503 when bootstrap token is not configured", () => {
      delete process.env.FEEDBACK_BOOTSTRAP_TOKEN;

      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "any-token" },
      });

      const result = authorizeBootstrap(req);

      expect(result?.status).toBe(503);
    });

    test("returns JSON with error message", async () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "wrong" },
      });

      const result = authorizeBootstrap(req);
      const body = await result?.json();

      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
    });

    test("is case sensitive", () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "VALID-TOKEN-123456" },
      });

      const result = authorizeBootstrap(req);

      expect(result?.status).toBe(403);
    });

    test("handles empty token", () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-bootstrap-token": "" },
      });

      const result = authorizeBootstrap(req);

      expect(result?.status).toBe(403);
    });
  });

  describe("authenticateApiKey", () => {
    test("authenticateApiKey function exists and is callable", async () => {
      const { authenticateApiKey: auth } = await import("@/lib/api-v1");
      expect(typeof auth).toBe("function");
    });

    test("handles valid request structure", async () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-api-key": "test-key" },
      });

      const { authenticateApiKey: auth } = await import("@/lib/api-v1");
      const result = await auth(req);

      expect(result).toHaveProperty("ok");
      expect(typeof result.ok).toBe("boolean");
    });

    test("returns object with ok and response or auth properties", async () => {
      const req = new NextRequest("http://localhost", {
        headers: { "x-api-key": "invalid-key" },
      });

      const { authenticateApiKey: auth } = await import("@/lib/api-v1");
      const result = await auth(req);

      expect(result).toHaveProperty("ok");
      if (result.ok) {
        expect(result).toHaveProperty("auth");
        expect(result.auth).toHaveProperty("keyId");
      } else {
        expect(result).toHaveProperty("response");
        expect(result.response).toBeDefined();
      }
    });
  });

  describe("requireAdmin", () => {
    test("returns null when auth is admin", () => {
      const auth: ApiKeyAuthContext = {
        keyId: 1,
        projectId: 100,
        projectSlug: "test-proj",
        projectName: "Test Project",
        isAdmin: true,
      };

      const result = requireAdmin(auth);

      expect(result).toBeNull();
    });

    test("returns error response when auth is not admin", () => {
      const auth: ApiKeyAuthContext = {
        keyId: 1,
        projectId: 100,
        projectSlug: "test-proj",
        projectName: "Test Project",
        isAdmin: false,
      };

      const result = requireAdmin(auth);

      expect(result?.status).toBe(403);
    });

    test("returns JSON with error message", async () => {
      const auth: ApiKeyAuthContext = {
        keyId: 1,
        projectId: 100,
        projectSlug: "test-proj",
        projectName: "Test Project",
        isAdmin: false,
      };

      const result = requireAdmin(auth);
      const body = await result?.json();

      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("Admin");
    });

    test("includes CORS headers", () => {
      const auth: ApiKeyAuthContext = {
        keyId: 1,
        projectId: 100,
        projectSlug: "test-proj",
        projectName: "Test Project",
        isAdmin: false,
      };

      const result = requireAdmin(auth);

      expect(result?.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});
