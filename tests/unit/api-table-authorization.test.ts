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
  assertCreateTableAccess,
  assertHasAllPermissions,
  assertSelectTableAccess,
} from "@/lib/api-table-authorization";
import { SITE_PERMISSIONS } from "@/lib/permissions";

describe("API Table Authorization", () => {
  describe("create access", () => {
    it("allows ECRF creation only with both access and create roles", () => {
      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_ACCESS_ECRF, SITE_PERMISSIONS.CAN_CREATE_ECRF],
          "participant_registrations",
        ),
      ).not.toThrow();

      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_ACCESS_ECRF],
          "participant_registrations",
        ),
      ).toThrow(/insufficient permissions/i);
    });

    it("blocks arbitrary table creation by default", () => {
      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_CREATE],
          "google_drive_cache",
        ),
      ).toThrow(/not allowed/i);
    });

    it("requires contacts admin privileges for contacts creation", () => {
      expect(() =>
        assertCreateTableAccess(
          [
            SITE_PERMISSIONS.CAN_ACCESS_CONTACTS,
            SITE_PERMISSIONS.CAN_CONTACTS_ADMIN,
          ],
          "contacts",
        ),
      ).not.toThrow();

      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_ACCESS_CONTACTS],
          "contacts",
        ),
      ).toThrow(/insufficient permissions/i);
    });

    it("requires PID generation permission for participant identifiers", () => {
      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_GENERATE_PID],
          "participant_identifiers",
        ),
      ).not.toThrow();

      expect(() =>
        assertCreateTableAccess(
          [SITE_PERMISSIONS.CAN_CREATE],
          "participant_identifiers",
        ),
      ).toThrow(/insufficient permissions/i);
    });
  });

  describe("select access", () => {
    it("allows public analytics tables without roles", () => {
      expect(() =>
        assertSelectTableAccess([], "study_site_status"),
      ).not.toThrow();
      expect(() =>
        assertSelectTableAccess([], "participant_recruitment_by_country"),
      ).not.toThrow();
    });

    it("blocks sensitive admin tables for basic authenticated users", () => {
      expect(() => assertSelectTableAccess([], "auth_sessions")).toThrow(
        /insufficient permissions/i,
      );
      expect(() => assertSelectTableAccess([], "system_settings")).toThrow(
        /insufficient permissions/i,
      );
      expect(() =>
        assertSelectTableAccess([], "participant_identifiers"),
      ).toThrow(/insufficient permissions/i);
    });

    it("allows access when the matching role is present", () => {
      expect(() =>
        assertSelectTableAccess(
          [SITE_PERMISSIONS.CAN_VIEW_ACCESS_LOGS],
          "auth_sessions",
        ),
      ).not.toThrow();
      expect(() =>
        assertSelectTableAccess(
          [SITE_PERMISSIONS.CAN_SET_SYSTEM_SETTINGS],
          "system_settings",
        ),
      ).not.toThrow();
      expect(() =>
        assertSelectTableAccess(
          [SITE_PERMISSIONS.CAN_VIEW_PID],
          "participant_identifiers",
        ),
      ).not.toThrow();
      expect(() =>
        assertSelectTableAccess(
          [SITE_PERMISSIONS.CAN_ACCESS_SUSPECTED_CASES],
          "suspected_cases_stats",
        ),
      ).not.toThrow();
    });

    it("denies unknown non-public tables by default", () => {
      expect(() =>
        assertSelectTableAccess(
          [SITE_PERMISSIONS.CAN_VIEW],
          "totally_unknown_table",
        ),
      ).toThrow(/not allowed/i);
    });
  });

  describe("non-table permission checks", () => {
    it("requires sync permission for central resource sync", () => {
      expect(() =>
        assertHasAllPermissions(
          [SITE_PERMISSIONS.CAN_SYNC_GOOGLE_FILES],
          [SITE_PERMISSIONS.CAN_SYNC_GOOGLE_FILES],
          "sync central resources",
        ),
      ).not.toThrow();

      expect(() =>
        assertHasAllPermissions(
          [],
          [SITE_PERMISSIONS.CAN_SYNC_GOOGLE_FILES],
          "sync central resources",
        ),
      ).toThrow(/insufficient permissions/i);
    });

    it("requires case report permission for form generator metadata", () => {
      expect(() =>
        assertHasAllPermissions(
          [SITE_PERMISSIONS.CAN_GENERATE_CASE_REPORTS],
          [SITE_PERMISSIONS.CAN_GENERATE_CASE_REPORTS],
          "access form generator metadata",
        ),
      ).not.toThrow();

      expect(() =>
        assertHasAllPermissions(
          [],
          [SITE_PERMISSIONS.CAN_GENERATE_CASE_REPORTS],
          "access form generator metadata",
        ),
      ).toThrow(/insufficient permissions/i);
    });
  });
});
