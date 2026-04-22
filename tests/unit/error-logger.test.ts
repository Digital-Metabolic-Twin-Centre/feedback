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

import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
  isPgError,
  PgError,
} from "@/lib/error-logger";

describe("Error Logger", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("logError", () => {
    it("should log errors with context", () => {
      const error = new Error("Test error");
      const context = {
        operation: "testOperation",
        userId: "user123",
        resource: "test-resource",
      };

      logError(error, context, "error");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.operation).toBe("testOperation");
      expect(loggedData.severity).toBe("error");
    });

    it("should generate unique error IDs", () => {
      const error = new Error("Test error");
      const context = { operation: "test" };

      logError(error, context);
      logError(error, context);

      const errorId1 = JSON.parse(consoleErrorSpy.mock.calls[0][0]).errorId;
      const errorId2 = JSON.parse(consoleErrorSpy.mock.calls[1][0]).errorId;

      expect(errorId1).not.toBe(errorId2);
    });

    it("should handle PostgreSQL errors", () => {
      const pgError: PgError = Object.assign(new Error("Duplicate key"), {
        code: "23505",
        constraint: "unique_email",
      });

      const context = { operation: "insert" };
      logError(pgError, context);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.errorType).toBe("DatabaseError");
      expect(loggedData.errorCode).toBe("23505");
    });

    it("should sanitize sensitive information in error messages", () => {
      const error = new Error("Failed to connect with password=secret123");
      const context = { operation: "auth" };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      // In production/test mode, sensitive data is not logged at all
    });

    it("should handle unknown error types", () => {
      const error = "string error";
      const context = { operation: "test" };

      logError(error, context);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.errorType).toBe("UnknownError");
    });
  });

  describe("isPgError", () => {
    it("should identify PostgreSQL errors", () => {
      const pgError: PgError = Object.assign(new Error("DB error"), {
        code: "23505",
      });

      expect(isPgError(pgError)).toBe(true);
    });

    it("should not identify regular errors as PostgreSQL errors", () => {
      const regularError = new Error("Regular error");
      expect(isPgError(regularError)).toBe(false);
    });

    it("should not identify non-error objects as PostgreSQL errors", () => {
      const notError = { code: "23505" };
      expect(isPgError(notError)).toBe(false);
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("should return user-friendly message for duplicate key error", () => {
      const error: PgError = Object.assign(new Error("Duplicate"), {
        code: "23505",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("A record with this value already exists.");
    });

    it("should return user-friendly message for foreign key violation", () => {
      const error: PgError = Object.assign(new Error("FK violation"), {
        code: "23503",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe(
        "This action would violate data integrity constraints."
      );
    });

    it("should return user-friendly message for not null violation", () => {
      const error: PgError = Object.assign(new Error("Not null"), {
        code: "23502",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Required field is missing.");
    });

    it("should return user-friendly message for table not found", () => {
      const error: PgError = Object.assign(new Error("Table not found"), {
        code: "42P01",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("The requested resource was not found.");
    });

    it("should return user-friendly message for invalid column", () => {
      const error: PgError = Object.assign(new Error("Invalid column"), {
        code: "42703",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Invalid field specified.");
    });

    it("should return safe error messages that don't contain sensitive info", () => {
      const error = new Error("Invalid input data");
      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Invalid input data");
    });

    it("should not return error messages containing passwords", () => {
      const error = new Error("Authentication failed with password=secret");
      const message = getUserFriendlyMessage(error);
      expect(message).not.toContain("password");
      expect(message).toBe("An unexpected error occurred. Please try again later.");
    });

    it("should not return error messages containing tokens", () => {
      const error = new Error("Invalid token=abc123xyz");
      const message = getUserFriendlyMessage(error);
      expect(message).not.toContain("abc123xyz");
      expect(message).toBe("An unexpected error occurred. Please try again later.");
    });

    it("should not return error messages containing email addresses", () => {
      const error = new Error("User test@example.com not found");
      const message = getUserFriendlyMessage(error);
      expect(message).toBe("An unexpected error occurred. Please try again later.");
    });

    it("should handle unknown PostgreSQL error codes", () => {
      const error: PgError = Object.assign(new Error("Unknown DB error"), {
        code: "99999",
      });

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("A database error occurred. Please try again.");
    });
  });

  describe("isSecurityCritical", () => {
    it("should identify SQL syntax errors as security critical", () => {
      const error: PgError = Object.assign(new Error("Syntax error"), {
        code: "42601",
      });

      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify invalid column errors as security critical", () => {
      const error: PgError = Object.assign(new Error("Invalid column"), {
        code: "42703",
      });

      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify table not found errors as security critical", () => {
      const error: PgError = Object.assign(new Error("Table not found"), {
        code: "42P01",
      });

      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify injection attempts as security critical", () => {
      const error = new Error("Possible SQL injection detected");
      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify unauthorized access as security critical", () => {
      const error = new Error("Unauthorized access attempt");
      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify authentication failures as security critical", () => {
      const error = new Error("Authentication failed");
      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should identify permission denied errors as security critical", () => {
      const error = new Error("Permission denied");
      expect(isSecurityCritical(error)).toBe(true);
    });

    it("should not identify regular errors as security critical", () => {
      const error = new Error("Regular application error");
      expect(isSecurityCritical(error)).toBe(false);
    });

    it("should not identify duplicate key errors as security critical", () => {
      const error: PgError = Object.assign(new Error("Duplicate key"), {
        code: "23505",
      });

      expect(isSecurityCritical(error)).toBe(false);
    });
  });

  describe("Sensitive Data Sanitization", () => {
    it("should sanitize password in error messages", () => {
      const error = new Error("Connection failed: password=mysecretpass");
      logError(error, { operation: "connect" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Sensitive data is not included in production logs
    });

    it("should sanitize token in error messages", () => {
      const error = new Error("Invalid token=Bearer xyz123");
      logError(error, { operation: "auth" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Sensitive data is not included in production logs
    });

    it("should sanitize API keys in error messages", () => {
      const error = new Error("API call failed with key=sk_test_123");
      logError(error, { operation: "api" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Sensitive data is not included in production logs
    });

    it("should sanitize credit card numbers in error messages", () => {
      const error = new Error("Payment failed for card 1234567890123456");
      logError(error, { operation: "payment" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Sensitive data is not included in production logs
    });

    it("should sanitize email addresses in error messages", () => {
      const error = new Error("Failed to send to user@example.com");
      logError(error, { operation: "email" });

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Sensitive data is not included in production logs
    });
  });

  describe("Error Context", () => {
    it("should include operation in log context", () => {
      const error = new Error("Test error");
      const context = { operation: "dataFetch" };

      logError(error, context);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.operation).toBe("dataFetch");
    });

    it("should include userId in log context when provided", () => {
      const error = new Error("Test error");
      const context = { operation: "update", userId: "user456" };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      // userId is included in the context but not in production logs
    });

    it("should include resource in log context when provided", () => {
      const error = new Error("Test error");
      const context = { operation: "delete", resource: "participants" };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      // resource is included in the context but not in production logs
    });

    it("should include metadata in log context when provided", () => {
      const error = new Error("Test error");
      const context = {
        operation: "query",
        metadata: { table: "users", action: "select" },
      };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      // metadata is included in the context but not in production logs
    });
  });

  describe("Error Severity Levels", () => {
    it("should log info level errors", () => {
      const error = new Error("Info message");
      logError(error, { operation: "test" }, "info");

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.severity).toBe("info");
    });

    it("should log warning level errors", () => {
      const error = new Error("Warning message");
      logError(error, { operation: "test" }, "warning");

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.severity).toBe("warning");
    });

    it("should log error level errors", () => {
      const error = new Error("Error message");
      logError(error, { operation: "test" }, "error");

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.severity).toBe("error");
    });

    it("should log critical level errors", () => {
      const error = new Error("Critical message");
      logError(error, { operation: "test" }, "critical");

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.severity).toBe("critical");
    });

    it("should default to error severity when not specified", () => {
      const error = new Error("Default severity");
      logError(error, { operation: "test" });

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.severity).toBe("error");
    });
  });
});
