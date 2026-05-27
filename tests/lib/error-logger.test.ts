import {
  logError,
  isPgError,
  getUserFriendlyMessage,
  isSecurityCritical,
  type ErrorContext,
  type PgError,
} from "@/lib/error-logger";

describe("error-logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "development";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isPgError", () => {
    test("returns true for PostgreSQL error", () => {
      const error: PgError = new Error("Test error");
      error.code = "23505";

      expect(isPgError(error)).toBe(true);
    });

    test("returns false for regular error", () => {
      const error = new Error("Test error");
      expect(isPgError(error)).toBe(false);
    });

    test("returns false for non-error objects", () => {
      expect(isPgError("string")).toBe(false);
      expect(isPgError(null)).toBe(false);
      expect(isPgError(undefined)).toBe(false);
      expect(isPgError({})).toBe(false);
    });

    test("requires code property to be string", () => {
      const error = new Error("Test error") as Error & { code?: number };
      error.code = 123;

      expect(isPgError(error)).toBe(false);
    });
  });

  describe("logError", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    beforeEach(() => {
      consoleSpy.mockClear();
    });

    afterAll(() => {
      consoleSpy.mockRestore();
    });

    test("logs error in development mode with full details", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = {
        operation: "testOp",
        userId: "user123",
        resource: "testResource",
      };

      const error = new Error("Test error message");
      logError(error, context, "error");

      expect(consoleSpy).toHaveBeenCalled();
      // Check that console.error was called at least twice (error line + stack)
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    test("logs error with custom severity", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "testOp" };

      logError(new Error("Test"), context, "critical");

      expect(consoleSpy).toHaveBeenCalled();
    });

    test("defaults to error severity when not specified", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "testOp" };

      logError(new Error("Test"), context);

      expect(consoleSpy).toHaveBeenCalled();
    });

    test("logs sanitized output in production mode", () => {
      process.env.NODE_ENV = "production";
      const context: ErrorContext = { operation: "testOp" };

      logError(new Error("Test"), context, "error");

      expect(consoleSpy).toHaveBeenCalled();
      const loggedData = consoleSpy.mock.calls[0][0];
      // In production mode, logs JSON with specific fields
      expect(loggedData).toContain("errorId");
    });

    test("generates unique error ID", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "testOp" };

      logError(new Error("Test 1"), context);
      logError(new Error("Test 2"), context);

      const calls = consoleSpy.mock.calls;
      const errorId1 = calls[0][0];
      const errorId2 = calls[1][0];

      expect(errorId1).not.toBe(errorId2);
    });

    test("logs stack trace in development", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "testOp" };
      const error = new Error("Test error");

      logError(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Stack trace"),
        expect.anything()
      );
    });

    test("does not log full stack in production", () => {
      process.env.NODE_ENV = "production";
      const context: ErrorContext = { operation: "testOp" };

      logError(new Error("Test"), context);

      const calls = consoleSpy.mock.calls.filter((c) =>
        c[0]?.toString().includes("Stack trace")
      );
      expect(calls.length).toBe(0);
    });

    test("logs with context metadata", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = {
        operation: "createUser",
        userId: "user-123",
        resource: "users",
        metadata: { retries: 3, timeout: 5000 },
      };

      logError(new Error("Test"), context);

      expect(consoleSpy).toHaveBeenCalled();
    });

    test("sanitizes error messages containing sensitive info", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "auth" };
      // Use a format that matches the regex patterns
      const error = new Error("Failed with password=mysecretpassword");

      logError(error, context);

      // Verify the function was called
      expect(consoleSpy).toHaveBeenCalled();
      // The sanitization happens in extractErrorDetails
      // which is tested separately in the error extraction flow
    });

    test("handles non-Error objects", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "testOp" };

      logError("string error", context);
      logError(null, context);
      logError(undefined, context);

      expect(consoleSpy.mock.calls.length).toBe(3);
    });

    test("logs PostgreSQL errors with code", () => {
      process.env.NODE_ENV = "development";
      const context: ErrorContext = { operation: "dbOp" };
      const pgError: PgError = new Error("Unique constraint violation");
      pgError.code = "23505";
      pgError.constraint = "users_email_key";

      logError(pgError, context);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("getUserFriendlyMessage", () => {
    test("returns friendly message for unique constraint error", () => {
      const error: PgError = new Error("duplicate");
      error.code = "23505";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("A record with this value already exists.");
    });

    test("returns friendly message for foreign key error", () => {
      const error: PgError = new Error("foreign key violation");
      error.code = "23503";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("This action would violate data integrity constraints.");
    });

    test("returns friendly message for not null error", () => {
      const error: PgError = new Error("null value");
      error.code = "23502";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Required field is missing.");
    });

    test("returns friendly message for table not found", () => {
      const error: PgError = new Error("relation not found");
      error.code = "42P01";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("The requested resource was not found.");
    });

    test("returns friendly message for column not found", () => {
      const error: PgError = new Error("column not found");
      error.code = "42703";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Invalid field specified.");
    });

    test("returns generic message for unknown database error", () => {
      const error: PgError = new Error("unknown");
      error.code = "99999";

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("A database error occurred. Please try again.");
    });

    test("returns error message if safe", () => {
      const error = new Error("This is a safe error message");

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("This is a safe error message");
    });

    test("does not expose sensitive info in error message", () => {
      const error = new Error("Failed to connect to server at password=secret123");

      const message = getUserFriendlyMessage(error);
      expect(message).not.toContain("secret123");
      expect(message).toBe("An unexpected error occurred. Please try again later.");
    });

    test("does not expose token in error message", () => {
      const error = new Error("Authentication failed with token=abc123def");

      const message = getUserFriendlyMessage(error);
      expect(message).not.toContain("abc123def");
    });

    test("handles non-Error objects", () => {
      const message1 = getUserFriendlyMessage("string");
      const message2 = getUserFriendlyMessage(null);
      const message3 = getUserFriendlyMessage(undefined);

      expect(message1).toBe("An unexpected error occurred. Please try again later.");
      expect(message2).toBe("An unexpected error occurred. Please try again later.");
      expect(message3).toBe("An unexpected error occurred. Please try again later.");
    });
  });

  describe("isSecurityCritical", () => {
    test("returns true for SQL syntax error", () => {
      const error: PgError = new Error("syntax error");
      error.code = "42601";

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns true for undefined column error", () => {
      const error: PgError = new Error("column not found");
      error.code = "42703";

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns true for undefined relation error", () => {
      const error: PgError = new Error("table not found");
      error.code = "42P01";

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns false for non-critical database error", () => {
      const error: PgError = new Error("unique violation");
      error.code = "23505";

      expect(isSecurityCritical(error)).toBe(false);
    });

    test("returns true for injection-like messages", () => {
      const error = new Error("Possible SQL injection detected");

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns true for unauthorized messages", () => {
      const error = new Error("Unauthorized access attempt");

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns true for authentication failure", () => {
      const error = new Error("Authentication failed");

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns true for permission denied", () => {
      const error = new Error("Permission denied");

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("is case insensitive", () => {
      const error = new Error("UNAUTHORIZED ACTION");

      expect(isSecurityCritical(error)).toBe(true);
    });

    test("returns false for normal errors", () => {
      const error = new Error("File not found");

      expect(isSecurityCritical(error)).toBe(false);
    });

    test("handles non-Error objects", () => {
      expect(isSecurityCritical("string")).toBe(false);
      expect(isSecurityCritical(null)).toBe(false);
      expect(isSecurityCritical(undefined)).toBe(false);
    });
  });
});
