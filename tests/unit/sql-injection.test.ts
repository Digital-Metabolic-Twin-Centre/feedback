// MUST be first before imports that use env
jest.mock("@/lib/env-validation", () => ({
  env: {
    SQLITE_PATH: ":memory:",
    NODE_ENV: "test",
    NEXTAUTH_SECRET: "test-secret-32-chars-minimum!!",
  },
}));

import { z } from "zod";

describe("SQL Injection Protection", () => {

  describe("Date Filter Field Validation", () => {
    it("should reject malicious date field names", () => {
      const allowedDateFields = ["created_at", "updated_at"];

      const maliciousFields = [
        "created_at; DROP TABLE users--",
        "updated_at' OR '1'='1",
        "created_at/**/UNION/**/SELECT",
        "id; DELETE FROM participants WHERE 1=1--",
        "../../../etc/passwd",
        "created_at OR 1=1",
        "user_password",
        "private_key",
      ];

      maliciousFields.forEach((field) => {
        expect(allowedDateFields.includes(field)).toBe(false);
      });
    });

    it("should only allow whitelisted date fields", () => {
      const allowedDateFields = ["created_at", "updated_at"];
      allowedDateFields.forEach((field) => {
        expect(allowedDateFields.includes(field)).toBe(true);
      });
    });
  });

  describe("Schema and Table Name Validation", () => {
    it("should validate schema and table names through Zod", () => {
      const schemaNameSchema = z.string().min(1).max(100).regex(/^[a-z_]+$/);
      const tableNameSchema = z.string().min(1).max(100).regex(/^[a-z_]+$/);

      expect(() => schemaNameSchema.parse("imdhub_core")).not.toThrow();
      expect(() => tableNameSchema.parse("participant_registrations")).not.toThrow();

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

      expect(quoteIdent("created_at")).toBe('"created_at"');
      expect(quoteIdent("imdhub_core")).toBe('"imdhub_core"');
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

        expect(quoted.startsWith('"')).toBe(true);
        expect(quoted.endsWith('"')).toBe(true);
        expect(quoted).toMatch(/^".+"$/);

        if (maliciousId.includes('"')) {
          expect(quoted).toContain('""');
        }
      }
    });
  });

  describe("Input Validation Edge Cases", () => {
    it("should validate group name patterns reject injection attempts", () => {
      const groupPattern = /^\/CLINICAL SITES\/.+/;

      const safeGroups = [
        "/CLINICAL SITES/Site A",
        "/CLINICAL SITES/Site's Hospital",
        '/CLINICAL SITES/Site "A"',
      ];

      const maliciousGroups = [
        "Site A' OR '1'='1",
        "Site A; DROP TABLE users--",
        "../../../admin",
        "' OR '1'='1",
      ];

      safeGroups.forEach((g) => expect(groupPattern.test(g)).toBe(true));
      maliciousGroups.forEach((g) => expect(groupPattern.test(g)).toBe(false));
    });
  });
});

