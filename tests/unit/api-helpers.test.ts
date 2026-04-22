import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getToken } from "next-auth/jwt";


// MUST come first
jest.mock("@/lib/env-validation", () => ({
  env: {
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    DATABASE_URL: "postgres://test",
    KEYCLOAK_CLIENT_ID: "dummy",
    KEYCLOAK_DOMAIN: "http://dummy",
    KEYCLOAK_JWKS_URI: "http://dummy",
    KEYCLOAK_CLIENT_SECRET: "dummy",
    CENTRAL_RESOURCES_FOLDER_ID: "dummy",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "dummy@example.com",
    GOOGLE_PRIVATE_KEY: "dummy",
    GITLAB_ISSUES_REPORTING_TOKEN: "dummy",
    GITLAB_REPORTING_PROJECT_ID: "123",
  },
}));

// can import modules now
import { env } from "@/lib/env-validation";
import {
  ApiError,
  validateRequestBody,
  validateQueryParams,
  verifyToken,
  handleApiError,
  successResponse,
  extractFilters,
} from "@/lib/api-helpers";




// Mock next-auth/jwt
jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));



// Mock NextResponse
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({
      body,
      status: init?.status || 200,
      statusText: "",
      headers: new Headers(),
    })),
    redirect: jest.fn((url) => ({
      status: 307,
      url: url.toString(),
      statusText: "",
      headers: new Headers(),
    })),
  },
}));

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

describe("ApiError", () => {
  it("creates an ApiError with message and default status code", () => {
    const error = new ApiError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("ApiError");
    expect(error.redirectUrl).toBeUndefined();
  });

  it("creates an ApiError with custom status code", () => {
    const error = new ApiError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
  });

  it("creates an ApiError with redirect URL", () => {
    const error = new ApiError("Unauthorized", 401, "/login");
    expect(error.message).toBe("Unauthorized");
    expect(error.statusCode).toBe(401);
    expect(error.redirectUrl).toBe("/login");
  });

  it("extends Error class correctly", () => {
    const error = new ApiError("Test error");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("preserves stack trace", () => {
    const error = new ApiError("Test error");
    expect(error.stack).toBeDefined();
  });
});

describe("validateRequestBody", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it("validates and returns parsed data for valid request body", async () => {
    const mockReq = {
      json: jest.fn().mockResolvedValue({ name: "John", age: 30 }),
    } as unknown as NextRequest;

    const result = await validateRequestBody(mockReq, schema);
    expect(result).toEqual({ name: "John", age: 30 });
  });

  it("throws ApiError with validation details for invalid data", async () => {
    const mockReq = {
      json: jest.fn().mockResolvedValue({ name: "John", age: "invalid" }),
    } as unknown as NextRequest;

    await expect(validateRequestBody(mockReq, schema)).rejects.toThrow(
      ApiError
    );

    try {
      await validateRequestBody(mockReq, schema);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toContain("Validation failed");
    }
  });

  it("throws ApiError for invalid JSON", async () => {
    const mockReq = {
      json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
    } as unknown as NextRequest;

    await expect(validateRequestBody(mockReq, schema)).rejects.toThrow(
      "Invalid request body"
    );

    try {
      await validateRequestBody(mockReq, schema);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it("handles nested validation errors", async () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          email: z.string().email(),
        }),
      }),
    });

    const mockReq = {
      json: jest
        .fn()
        .mockResolvedValue({ user: { profile: { email: "invalid" } } }),
    } as unknown as NextRequest;

    try {
      await validateRequestBody(mockReq, nestedSchema);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain("Validation failed");
    }
  });

  it("handles empty request body", async () => {
    const schema = z.object({
      field: z.string().optional(),
    });

    const mockReq = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const result = await validateRequestBody(mockReq, schema);
    expect(result).toEqual({});
  });

  it("handles array data in request body", async () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const mockReq = {
      json: jest.fn().mockResolvedValue({ items: ["a", "b", "c"] }),
    } as unknown as NextRequest;

    const result = await validateRequestBody(mockReq, schema);
    expect(result).toEqual({ items: ["a", "b", "c"] });
  });

  it("throws error when required fields are missing", async () => {
    const schema = z.object({
      requiredField: z.string(),
    });

    const mockReq = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    await expect(validateRequestBody(mockReq, schema)).rejects.toThrow(
      ApiError
    );
  });
});

describe("validateQueryParams", () => {
  const schema = z.object({
    page: z.string(),
    limit: z.string(),
  });

  it("validates and returns parsed query parameters", () => {
    const mockReq = {
      url: "http://localhost:3000/api/test?page=1&limit=10",
    } as NextRequest;

    const result = validateQueryParams(mockReq, schema);
    expect(result).toEqual({ page: "1", limit: "10" });
  });

  it("throws ApiError for missing required parameters", () => {
    const mockReq = {
      url: "http://localhost:3000/api/test?page=1",
    } as NextRequest;

    expect(() => validateQueryParams(mockReq, schema)).toThrow(ApiError);

    try {
      validateQueryParams(mockReq, schema);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toContain("Query validation failed");
    }
  });

  it("handles empty query parameters", () => {
    const emptySchema = z.object({});
    const mockReq = {
      url: "http://localhost:3000/api/test",
    } as NextRequest;

    const result = validateQueryParams(mockReq, emptySchema);
    expect(result).toEqual({});
  });

  it("handles optional query parameters", () => {
    const optionalSchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    });

    const mockReq = {
      url: "http://localhost:3000/api/test?page=1",
    } as NextRequest;

    const result = validateQueryParams(mockReq, optionalSchema);
    expect(result).toEqual({ page: "1" });
  });

  it("throws ApiError with proper path for nested validation errors", () => {
    const mockReq = {
      url: "http://localhost:3000/api/test?page=invalid",
    } as NextRequest;

    const numberSchema = z.object({
      page: z.string().transform((val) => {
        const num = parseInt(val);
        if (isNaN(num)) throw new Error("Invalid number");
        return num;
      }),
    });

    try {
      validateQueryParams(mockReq, numberSchema);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it("handles multiple query parameters with same key (takes last)", () => {
    const schema = z.object({
      filter: z.string(),
    });

    const mockReq = {
      url: "http://localhost:3000/api/test?filter=first&filter=second",
    } as NextRequest;

    const result = validateQueryParams(mockReq, schema);
    expect(result.filter).toBe("second");
  });

  it("handles special characters in query params", () => {
    const schema = z.object({
      search: z.string(),
    });

    const mockReq = {
      url: "http://localhost:3000/api/test?search=hello%20world",
    } as NextRequest;

    const result = validateQueryParams(mockReq, schema);
    expect(result.search).toBe("hello world");
  });

  it("throws for non-ZodError exceptions", () => {
    const mockReq = {
      url: "invalid-url",
    } as NextRequest;

    const schema = z.object({
      test: z.string(),
    });

    expect(() => validateQueryParams(mockReq, schema)).toThrow(ApiError);
  });
});

describe("verifyToken", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns token when authentication is successful", async () => {
    const mockToken = { sub: "user123", email: "test@example.com" };
    mockGetToken.mockResolvedValue(mockToken);

    const mockReq = {} as NextRequest;
    const result = await verifyToken(mockReq);

    expect(result).toEqual({
      userId: "user123",
      email: "test@example.com",
      roles: [],
      realmRoles: [],
      groups: [],
      token: mockToken,
    });
    expect(mockGetToken).toHaveBeenCalledWith({
      req: mockReq,
      secret: env.NEXTAUTH_SECRET,
    });
  });

  it("throws ApiError when token is missing and not allowing public access", async () => {
    mockGetToken.mockResolvedValue(null);

    const mockReq = {} as NextRequest;

    await expect(verifyToken(mockReq, false)).rejects.toThrow(ApiError);

    try {
      await verifyToken(mockReq);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(401);
      expect((error as ApiError).message).toBe("Unauthorized: No valid token");
      expect((error as ApiError).redirectUrl).toBe(
        "/unauthorized?reason=no-permissions"
      );
    }
  });

  it("returns null when token is missing but allowing public access", async () => {
    mockGetToken.mockResolvedValue(null);

    const mockReq = {} as NextRequest;
    const result = await verifyToken(mockReq, true);

    expect(result).toBeNull();
  });

  it("returns token when allowing public access and token exists", async () => {
    const mockToken = { sub: "user123", email: "test@example.com" };
    mockGetToken.mockResolvedValue(mockToken);

    const mockReq = {} as NextRequest;
    const result = await verifyToken(mockReq, true);

    expect(result).toEqual({
      userId: "user123",
      email: "test@example.com",
      roles: [],
      realmRoles: [],
      groups: [],
      token: mockToken,
    });
  });
});

describe("handleApiError", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("handles ApiError with redirect URL", () => {
    const error = new ApiError("Unauthorized", 401, "/login");
    const mockReq = {
      url: "http://localhost:3000/api/test",
      headers: new Headers({
        host: "localhost:3000",
      }),
    } as NextRequest;

    const response = handleApiError(error, mockReq);

    expect(response.status).toBe(307); // NextResponse.redirect default status
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it("handles ApiError without redirect URL", () => {
    const error = new ApiError("Bad request", 400);
    const mockReq = {} as NextRequest;

    const response = handleApiError(error, mockReq);

    expect(response.status).toBe(400);
    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: false, message: "Bad request" },
      { status: 400 }
    );
  });

  it("handles ZodError", () => {
    const zodError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["name"],
        message: "Expected string, received number",
      },
    ]);

    const mockReq = {} as NextRequest;
    const response = handleApiError(zodError, mockReq);

    expect(response.status).toBe(400);
    expect(NextResponse.json).toHaveBeenCalled();
  });

  it("handles generic Error instances", () => {
    const error = new Error("Something went wrong");
    const mockReq = {} as NextRequest;

    const response = handleApiError(error, mockReq);

    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "API Error:",
      "Something went wrong",
      error
    );
  });

  it("handles unknown error types", () => {
    const error = "String error";
    const mockReq = {} as NextRequest;

    const response = handleApiError(error, mockReq);

    expect(response.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "API Error:",
      "Unknown error",
      error
    );
  });

  it("logs errors to console for debugging", () => {
    const error = new Error("Test error");
    const mockReq = {} as NextRequest;

    handleApiError(error, mockReq);

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("successResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns success response with default status 200", () => {
    const data = { message: "Success", userId: 123 };
    const response = successResponse(data);

    expect(response.status).toBe(200);
    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: true, message: "Success", userId: 123 },
      { status: 200 }
    );
  });

  it("returns success response with custom status code", () => {
    const data = { message: "Created", id: 456 };
    const response = successResponse(data, 201);

    expect(response.status).toBe(201);
    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: true, message: "Created", id: 456 },
      { status: 201 }
    );
  });

  it("includes success: true in response", () => {
    const data = { items: [1, 2, 3] };
    const response = successResponse(data);

    expect(response.status).toBe(200);
    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
      expect.any(Object)
    );
  });

  it("merges data with success flag", () => {
    const data = { users: [], count: 0 };
    const response = successResponse(data);

    expect(response.status).toBe(200);
    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: true, users: [], count: 0 },
      { status: 200 }
    );
  });
});

describe("extractFilters", () => {
  it("extracts all query parameters as filters", () => {
    const searchParams = new URLSearchParams({
      status: "active",
      category: "electronics",
      minPrice: "100",
    });

    const filters = extractFilters(searchParams);
    expect(filters).toEqual({
      status: "active",
      category: "electronics",
      minPrice: "100",
    });
  });

  it("excludes specified keys from filters", () => {
    const searchParams = new URLSearchParams({
      page: "1",
      limit: "10",
      status: "active",
      category: "electronics",
    });

    const filters = extractFilters(searchParams, ["page", "limit"]);
    expect(filters).toEqual({
      status: "active",
      category: "electronics",
    });
  });

  it("returns empty object when no parameters exist", () => {
    const searchParams = new URLSearchParams();

    const filters = extractFilters(searchParams);
    expect(filters).toEqual({});
  });

  it("returns empty object when all parameters are excluded", () => {
    const searchParams = new URLSearchParams({
      page: "1",
      limit: "10",
    });

    const filters = extractFilters(searchParams, ["page", "limit"]);
    expect(filters).toEqual({});
  });

  it("handles parameters with empty values", () => {
    const searchParams = new URLSearchParams({
      search: "",
      status: "active",
    });

    const filters = extractFilters(searchParams);
    expect(filters).toEqual({
      search: "",
      status: "active",
    });
  });

  it("excludes keys case-sensitively", () => {
    const searchParams = new URLSearchParams({
      Page: "1",
      page: "2",
      status: "active",
    });

    const filters = extractFilters(searchParams, ["page"]);
    expect(filters).toEqual({
      Page: "1",
      status: "active",
    });
  });
});
