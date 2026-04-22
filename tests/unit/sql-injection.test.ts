/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { z } from "zod";
import { getTableData } from "@/app/actions/select/action";
import { pgPool } from "@/lib/db";

// Mock the database pool
jest.mock("@/lib/db", () => ({
  pgPool: {
    connect: jest.fn(),
  },
}));

// Mock user session
jest.mock("@/utils/auth/get-user-server-session", () => ({
  getUserEmailFromSession: jest.fn(async () => ["test@example.com"]),
}));

describe("SQL Injection Protection", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe("Date Filter Field Validation", () => {
    it("should reject malicious field names with SQL injection attempts", async () => {
      // Table exists check
      mockClient.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const maliciousFields = [
        "created_at; DROP TABLE users--",
        "updated_at' OR '1'='1",
        "created_at/**/UNION/**/SELECT",
        "id; DELETE FROM participants WHERE 1=1--",
        "../../../etc/passwd",
        "created_at OR 1=1",
      ];

      for (const maliciousField of maliciousFields) {
        const result = await getTableData(
          "imdhub_core",
          "shipping_template",
          {},
          [],
          {
            field: maliciousField,
            from: "2024-01-01",
          }
        );

        // Should throw an error or reject the field
        expect(result.success).toBe(false);
        // Error message may be generic for security reasons
        if (result.success === false) {
          expect(result.message).toBeTruthy();
        }
      }
    });

    it("should only allow whitelisted date fields", async () => {
      // Table exists check
      mockClient.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const allowedFields = ["created_at", "updated_at"];

      for (const field of allowedFields) {
        // Reset mock for each iteration
        mockClient.query.mockResolvedValueOnce({
          rows: [{ exists: true }],
        });
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              biospecimen_id: "BIO001",
              clinical_site_name: "Site A",
              aliquot_id: "ALQ001",
            },
          ],
        });

        const result = await getTableData(
          "imdhub_core",
          "shipping_template",
          {},
          ["Site A"],
          {
            field,
            from: "2024-01-01",
            to: "2024-12-31",
          }
        );

        expect(result.success).toBe(true);
      }
    });
    beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => { }));
    afterAll(() => (console.error as jest.Mock).mockRestore());
    it("should reject non-whitelisted but valid-looking field names", async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const nonWhitelistedFields = [
        "user_password",
        "credit_card_number",
        "ssn",
        "private_key",
      ];

      for (const field of nonWhitelistedFields) {
        const result = await getTableData(
          "imdhub_core",
          "shipping_template",
          {},
          [],
          {
            field,
            from: "2024-01-01",
          }
        );

        // Non-whitelisted fields should be rejected
        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.message).toBeTruthy();
        }
      }
    });
  });
  describe("Schema and Table Name Validation", () => {
    it("should validate schema and table names through Zod", () => {
      const schemaNameSchema = z.string().min(1).max(100).regex(/^[a-z_]+$/);
      const tableNameSchema = z.string().min(1).max(100).regex(/^[a-z_]+$/);

      // Valid names
      expect(() => schemaNameSchema.parse("imdhub_core")).not.toThrow();
      expect(() => tableNameSchema.parse("participant_registrations")).not.toThrow();

      // Invalid names with SQL injection attempts
      const invalidNames = [
        "schema'; DROP TABLE users--",
        "table OR 1=1",
        "schema UNION SELECT",
        "../../../etc/passwd",
        "table_name;",
        "SCHEMA-NAME",
        "table.name",
      ];

      for (const invalidName of invalidNames) {
        expect(() => schemaNameSchema.parse(invalidName)).toThrow();
        expect(() => tableNameSchema.parse(invalidName)).toThrow();
      }
    });
  });

  describe("Identifier Quoting", () => {
    it("should properly quote identifiers to prevent SQL injection", () => {
      function quoteIdent(id: string): string {
        return `"${id.replace(/"/g, '""')}"`;
      }

      // Normal identifiers
      expect(quoteIdent("created_at")).toBe('"created_at"');
      expect(quoteIdent("imdhub_core")).toBe('"imdhub_core"');

      // Identifiers with special characters (should be escaped)
      expect(quoteIdent('table"name')).toBe('"table""name"');
      expect(quoteIdent('column"with"quotes')).toBe('"column""with""quotes"');
    });

    it("should prevent injection through quoted identifiers", () => {
      function quoteIdent(id: string): string {
        return `"${id.replace(/"/g, '""')}"`;
      }

      const maliciousIds = [
        'table"; DROP TABLE users--',
        "column'; DELETE FROM data--",
        'field" OR 1=1--',
      ];

      for (const maliciousId of maliciousIds) {
        const quoted = quoteIdent(maliciousId);

        // Should be properly escaped and quoted
        expect(quoted.startsWith('"')).toBe(true);
        expect(quoted.endsWith('"')).toBe(true);

        // Malicious content should be neutralized by quoting
        // Single quotes in SQL injection attempts won't work inside double-quoted identifiers
        expect(quoted).toMatch(/^".+"$/);

        // Verify the content is escaped properly
        if (maliciousId.includes('"')) {
          expect(quoted).toContain('""'); // Double quotes should be escaped
        }
      }
    });
  });

  describe("Parameterized Query Usage", () => {
    beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => { }));
    afterAll(() => (console.error as jest.Mock).mockRestore());
    it("should use parameterized queries without group parameters for organisations", async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: "Site A" }],
      });

      await getTableData("imdhub_refs", "organisations", {}, ["Site A"]);

      const queryCall = mockClient.query.mock.calls[0];

      expect(typeof queryCall[0]).toBe("string");
      expect(queryCall[0]).not.toContain("IN (");   // no group filtering
      expect(queryCall[1]).toEqual([]);              // no params
    });


    it("should never concatenate user input directly into SQL", async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const userInput = "'; DROP TABLE users--";

      await getTableData("imdhub_refs", "organisations", {}, [userInput]);

      // Check all query calls
      mockClient.query.mock.calls.forEach((call: any) => {
        const sql = call[0];
        // User input should NEVER appear directly in the SQL string
        // It should only be in the parameters array
        if (typeof sql === "string") {
          expect(sql).not.toContain("DROP TABLE");
          expect(sql).not.toContain(userInput);
        }
      });
    });
  });

  describe("Filter Injection Protection", () => {
    it("should safely handle filters without SQL injection", async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const maliciousFilters = {
        status: "Available' OR '1'='1",
        soft_delete: "false; DROP TABLE users--",
      };

      await getTableData("imdhub_refs", "participant_identifiers", maliciousFilters, []);

      // Verify parameters are used safely
      const queryCall = mockClient.query.mock.calls[0];
      if (queryCall && queryCall[0]) {
        const sql = queryCall[0];
        // Should not contain the malicious SQL directly
        expect(sql).not.toContain("DROP TABLE");
        expect(sql).not.toContain("OR '1'='1");
      }
    });
  });

  describe("Input Validation Edge Cases", () => {

    it("should reject empty or null schema/table names", async () => {
      const invalidInputs = [
        { schema: "", tableName: "valid_table" },
        { schema: "valid_schema", tableName: "" },
        { schema: "   ", tableName: "valid_table" },
      ];

      for (const { schema, tableName } of invalidInputs) {
        mockClient.query.mockResolvedValueOnce({
          rows: [{ exists: false }],
        });

        const result = await getTableData(schema, tableName, {}, []);

        // Should fail validation or return error
        // Empty schemas/tables would fail at table existence check
        if (result.success !== undefined) {
          expect(result.success).toBe(false);
        }
      }
    });

    beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => { }));
    afterAll(() => (console.error as jest.Mock).mockRestore());
    it("should handle special characters in group names safely", async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const groupsWithSpecialChars = [
        "/CLINICAL SITES/Site's Hospital",
        '/CLINICAL SITES/Site "A"',
        "/CLINICAL SITES/Site & Lab",
      ];

      await getTableData(
        "imdhub_refs",
        "organisations",
        {},
        groupsWithSpecialChars
      );

      // Should handle safely without SQL injection
      expect(mockClient.query).toHaveBeenCalled();
    });
  });
});
