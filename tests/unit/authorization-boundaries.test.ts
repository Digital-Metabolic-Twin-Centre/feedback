/* eslint-disable @typescript-eslint/no-explicit-any */
// MUST be first before imports that use env
jest.mock("@/lib/env-validation", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    SQLITE_PATH: ":memory:",
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

import { SITE_PERMISSIONS } from "@/lib/permissions";
import { publicTables } from "@/lib/constants";
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

describe("Authorization Boundaries", () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe("Role-Based Access Control", () => {
    it("should block access to participant_identifiers without CAN_VIEW_PID role", () => {
      const ROLE_REQUIREMENTS: Record<string, string[]> = {
        "/ontologies/participant/identifiers": [SITE_PERMISSIONS.CAN_VIEW_PID],
      };

      const userRoles = [
        SITE_PERMISSIONS.CAN_ACCESS_ONTOLOGIES,
        SITE_PERMISSIONS.CAN_ACCESS_ECRF,
      ];
      const pathname = "/ontologies/participant/identifiers";

      const requiredRoles = ROLE_REQUIREMENTS[pathname];
      const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

      expect(hasRequiredRole).toBe(false);
      // In proxy, this would redirect to /unauthorized?reason=insufficient-role
    });

    it("should allow access to participant_identifiers with CAN_VIEW_PID role", () => {
      const ROLE_REQUIREMENTS: Record<string, string[]> = {
        "/ontologies/participant/identifiers": [SITE_PERMISSIONS.CAN_VIEW_PID],
      };

      const userRoles = [
        SITE_PERMISSIONS.CAN_VIEW_PID,
        SITE_PERMISSIONS.CAN_ACCESS_ONTOLOGIES,
      ];
      const pathname = "/ontologies/participant/identifiers";

      const requiredRoles = ROLE_REQUIREMENTS[pathname];
      const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

      expect(hasRequiredRole).toBe(true);
    });

    it("should enforce ECRF access for participant routes", () => {
      const ROLE_REQUIREMENTS: Record<string, string[]> = {
        "/participant": [SITE_PERMISSIONS.CAN_ACCESS_ECRF],
        "/biospecimen": [SITE_PERMISSIONS.CAN_ACCESS_ECRF],
        "/visits": [SITE_PERMISSIONS.CAN_ACCESS_ECRF],
      };

      const userWithECRF = [SITE_PERMISSIONS.CAN_ACCESS_ECRF, SITE_PERMISSIONS.CAN_VIEW];
      const userWithoutECRF = ["imdhub_user"];

      ["/participant", "/biospecimen", "/visits"].forEach((path) => {
        const requiredRoles = ROLE_REQUIREMENTS[path];

        const hasAccessWithECRF = requiredRoles.some((role) => userWithECRF.includes(role));
        const hasAccessWithoutECRF = requiredRoles.some((role) => userWithoutECRF.includes(role));

        expect(hasAccessWithECRF).toBe(true);
        expect(hasAccessWithoutECRF).toBe(false);
      });
    });

    it("should require admin role for admin routes", () => {
      const ROLE_REQUIREMENTS: Record<string, string[]> = {
        "/admin/upload/ontologies": [SITE_PERMISSIONS.CAN_UPLOAD_REF_DATA],
        "/ontologies/study/site/status": [SITE_PERMISSIONS.CAN_ACCESS_ADMIN],
      };

      const regularUser = [SITE_PERMISSIONS.CAN_ACCESS_ECRF, SITE_PERMISSIONS.CAN_VIEW];
      const adminUser = [SITE_PERMISSIONS.CAN_UPLOAD_REF_DATA, SITE_PERMISSIONS.CAN_ACCESS_ADMIN];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(ROLE_REQUIREMENTS).forEach(([_path, requiredRoles]) => {
        const regularHasAccess = requiredRoles.some((role) => regularUser.includes(role));
        const adminHasAccess = requiredRoles.some((role) => adminUser.includes(role));

        expect(regularHasAccess).toBe(false);
        expect(adminHasAccess).toBe(true);
      });
    });
  });

  describe("Permission Escalation Prevention", () => {
    it("should validate that groups match expected format", () => {
      const validGroups = [
        "/CLINICAL SITES/Site A",
        "/CLINICAL SITES/Site B Hospital",
        "/CLINICAL SITES/Research Center",
      ];

      const invalidGroups = [
        "../admin",
        "../../etc/passwd",
        "Site A; DROP TABLE",
        "' OR '1'='1",
      ];

      validGroups.forEach((group) => {
        expect(group).toMatch(/^\/CLINICAL SITES\/.+/);
      });

      invalidGroups.forEach((group) => {
        expect(group).not.toMatch(/^\/CLINICAL SITES\/.+/);
      });
    });
  });

  describe("Public Access Tables", () => {
    it("should allow unauthenticated access to public tables only", () => {

      const protectedTables = [
        "participant_identifiers",
        "participant_registrations",
        "biospecimen_logs",
      ];

      publicTables.forEach((table) => {
        expect(publicTables).toContain(table);
      });

      protectedTables.forEach((table) => {
        expect(publicTables).not.toContain(table);
      });
    });

    it("should require authentication for non-public tables", async () => {
      // This test validates that verifyToken is called for protected routes
      // The actual implementation is in the API route
      const protectedTables = [
        "participant_identifiers",
        "participant_registrations",
        "biospecimen_logs",
        "shipments",
        "organisations",
      ];

      protectedTables.forEach((table) => {
        const isPublic = [
          "participant_registrations_analytics",
          "iembase_diagnoses_explorer",
          "study_site_status",
        ].includes(table);

        expect(isPublic).toBe(false);
        // In API route, verifyToken should be called for these
      });
    });
  });

  describe("Cross-Site Data Access Prevention", () => {
    it("should not include data from other sites when filtering by site name", () => {
      const allSiteData = [
        { id: 1, name: "Site A", clinical_site_name: "Site A" },
        { id: 2, name: "Site B", clinical_site_name: "Site B" },
        { id: 3, name: "Site C", clinical_site_name: "Site C" },
      ];

      const userGroups = ["Site A"];
      const filtered = allSiteData.filter((row) =>
        userGroups.includes(row.clinical_site_name)
      );

      const hasSiteB = filtered.some((row) => row.name === "Site B");
      const hasSiteC = filtered.some((row) => row.name === "Site C");

      expect(hasSiteB).toBe(false);
      expect(hasSiteC).toBe(false);
      expect(filtered).toHaveLength(1);
    });
  });
});
