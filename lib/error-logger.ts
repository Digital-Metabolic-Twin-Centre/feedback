/**
 * Centralised Error Logging Utility
 *
 * Provides structured error logging with context for security monitoring
 * and debugging without exposing sensitive information.
 */

import { env } from "./env-validation";

export type ErrorContext = {
  operation: string;
  userId?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
};

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

/**
 * PostgreSQL-specific error interface
 */
export interface PgError extends Error {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
}

/**
 * Check if error is a PostgreSQL error
 */
export function isPgError(error: unknown): error is PgError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as PgError).code === "string"
  );
}

/**
 * Log structured error with context
 */
export function logError(
  error: unknown,
  context: ErrorContext,
  severity: ErrorSeverity = "error"
): void {
  const timestamp = new Date().toISOString();
  const errorId = generateErrorId();

  // Extract error details safely
  const errorDetails = extractErrorDetails(error);

  // Structure log entry
  const logEntry = {
    timestamp,
    errorId,
    severity,
    context,
    error: errorDetails,
  };

  // Log based on environment
  if (env.NODE_ENV === "development") {
    console.error("Error:", JSON.stringify(logEntry, null, 2));
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
  } else {
    // Production: sanitized logging
    console.error(
      JSON.stringify({
        timestamp,
        errorId,
        severity,
        operation: context.operation,
        errorCode: errorDetails.code,
        errorType: errorDetails.type,
      })
    );
  }

  // TODO: Send critical errors to monitoring service (e.g., Sentry, DataDog or self hosted like Prometheus + Grafana)
  if (severity === "critical") {
    // await sendToMonitoring(logEntry);
  }
}

/**
 * Extract error details safely without exposing sensitive info
 */
function extractErrorDetails(error: unknown): {
  type: string;
  message: string;
  code?: string;
  constraint?: string;
} {
  if (isPgError(error)) {
    return {
      type: "DatabaseError",
      message: sanitizeErrorMessage(error.message),
      code: error.code,
      constraint: error.constraint,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: sanitizeErrorMessage(error.message),
    };
  }

  return {
    type: "UnknownError",
    message: "An unexpected error occurred",
  };
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(message: string): string {
  // Remove potential sensitive patterns
  return message
    .replace(/password[=:]\s*["']?[\w@!#$%^&*]+["']?/gi, "password=***")
    .replace(/token[=:]\s*["']?[\w-_.]+["']?/gi, "token=***")
    .replace(/key[=:]\s*["']?[\w-_.]+["']?/gi, "key=***")
    .replace(/\b\d{16}\b/g, "****") // Credit card patterns
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      "***@***.***"
    ); // Emails
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isPgError(error)) {
    switch (error.code) {
      case "23505":
        return "A record with this value already exists.";
      case "23503":
        return "This action would violate data integrity constraints.";
      case "23502":
        return "Required field is missing.";
      case "42P01":
        return "The requested resource was not found.";
      case "42703":
        return "Invalid field specified.";
      default:
        return "A database error occurred. Please try again.";
    }
  }

  if (error instanceof Error) {
    // Only return the message if it's safe (doesn't contain sensitive info)
    if (!containsSensitiveInfo(error.message)) {
      return error.message;
    }
  }

  return "An unexpected error occurred. Please try again later.";
}

/**
 * Check if message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /\d{16}/, // Credit card
    /@.*\./, // Email
  ];

  return sensitivePatterns.some((pattern) => pattern.test(message));
}

/**
 * Check if error should trigger security alert
 */
export function isSecurityCritical(error: unknown): boolean {
  if (isPgError(error)) {
    // SQL injection attempts often trigger these
    const criticalCodes = ["42601", "42703", "42P01"];
    return error.code ? criticalCodes.includes(error.code) : false;
  }

  if (error instanceof Error) {
    const criticalPatterns = [
      /injection/i,
      /unauthorized/i,
      /authentication failed/i,
      /permission denied/i,
    ];
    return criticalPatterns.some((pattern) => pattern.test(error.message));
  }

  return false;
}
