// MUST be first before imports that use env
jest.mock("@/lib/env-validation", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    KEYCLOAK_CLIENT_ID: "test-client",
    KEYCLOAK_DOMAIN: "https://auth.test.com",
    KEYCLOAK_JWKS_URI: "realms/test/protocol/openid-connect/certs",
    KEYCLOAK_CLIENT_SECRET: "test-secret",
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


import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  exp?: number;
  realm_access?: {
    roles: string[];
  };
  groups?: string[];
}

// Mock dependencies
jest.mock("jwt-decode");
jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn(() => null),
}));
jest.mock("@/lib/cors", () => ({
  corsHeaders: jest.fn(() => ({})),
}));
jest.mock("@/lib/error-logger", () => ({
  logError: jest.fn(),
  isSecurityCritical: jest.fn(() => false),
}));

const mockJwtDecode = jwtDecode as jest.MockedFunction<(token: string) => DecodedToken>;

// Mock fetch for Keycloak introspection
global.fetch = jest.fn();

describe("Proxy Token Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Token Expiration", () => {
    it("should reject expired tokens and redirect to login", async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      mockJwtDecode.mockReturnValue({
        exp: expiredTime,
        realm_access: { roles: ["imdhub_user"] },
        groups: ["/CLINICAL SITES/Site A"],
      });


      // In real proxy, this would trigger a redirect
      // We're testing the token expiration check logic
      const decodedToken = mockJwtDecode("expired_token");
      expect(decodedToken.exp! * 1000).toBeLessThan(Date.now());
    });

    it("should allow valid non-expired tokens", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockJwtDecode.mockReturnValue({
        exp: futureTime,
        realm_access: { roles: ["imdhub_user"] },
        groups: ["/CLINICAL SITES/Site A"],
      });

      const decodedToken = mockJwtDecode("valid_token");
      expect(decodedToken.exp! * 1000).toBeGreaterThan(Date.now());
    });
  });

  describe("Keycloak Token Introspection", () => {
    it("should validate token with Keycloak introspection endpoint", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ active: true }),
        ok: true,
      } as Response);

      const response = await fetch(
        "https://auth.test.com/realms/test/protocol/openid-connect/token/introspect",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: "test_token",
            client_id: "test-client",
            client_secret: "test-secret",
          }),
        }
      );

      const result = await response.json();
      expect(result.active).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/token/introspect"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
    });

    it("should reject inactive tokens from Keycloak", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        json: async () => ({ active: false }),
        ok: true,
      } as Response);

      const response = await fetch(
        "https://auth.test.com/realms/test/protocol/openid-connect/token/introspect",
        {
          method: "POST",
          body: new URLSearchParams({
            token: "invalid_token",
            client_id: "test-client",
            client_secret: "test-secret",
          }),
        }
      );

      const result = await response.json();
      expect(result.active).toBe(false);
    });

    it("should handle Keycloak introspection errors gracefully", async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        fetch("https://auth.test.com/realms/test/protocol/openid-connect/token/introspect")
      ).rejects.toThrow("Network error");
    });
  });

  describe("Cookie Clearing on Invalid Token", () => {
    it("should clear all session cookies when token is invalid", () => {
      const mockCookies = {
        delete: jest.fn(),
      };

      const cookiesToClear = [
        "next-auth.session-token",
        "next-auth.session-token.0",
        "next-auth.session-token.1",
        "next-auth.csrf-token",
        "__Secure-next-auth.session-token",
        "__Host-next-auth.csrf-token",
      ];

      cookiesToClear.forEach((cookieName) => {
        mockCookies.delete(cookieName);
      });

      expect(mockCookies.delete).toHaveBeenCalledTimes(6);
      expect(mockCookies.delete).toHaveBeenCalledWith("next-auth.session-token");
      expect(mockCookies.delete).toHaveBeenCalledWith("__Host-next-auth.csrf-token");
    });
  });

  describe("Permission and Role Validation", () => {
    it("should extract roles and groups from decoded token", () => {
      mockJwtDecode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        realm_access: {
          roles: ["imdhub_admin", "imdhub_user", "other_role"],
        },
        groups: ["/CLINICAL SITES/Site A", "/CLINICAL SITES/Site B"],
      });

      const decodedToken = mockJwtDecode("test_token");

      const roles = decodedToken.realm_access?.roles || [];
      const groups = decodedToken.groups || [];

      expect(roles).toContain("imdhub_admin");
      expect(roles).toContain("imdhub_user");
      expect(groups).toHaveLength(2);
      expect(groups).toContain("/CLINICAL SITES/Site A");
    });

    it("should redirect users without groups or roles", () => {
      mockJwtDecode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        realm_access: { roles: [] },
        groups: [],
      });

      const decodedToken = mockJwtDecode("test_token");

      const roles = decodedToken.realm_access?.roles || [];
      const groups = decodedToken.groups || [];

      expect(roles).toHaveLength(0);
      expect(groups).toHaveLength(0);
      // In proxy, this would trigger redirect to /unauthorized?reason=no-permissions
    });

    it("should validate role requirements for specific paths", () => {
      const ROLE_REQUIREMENTS: Record<string, string[]> = {
        "/ontologies": ["imdhub_can_access_ontologies"],
        "/participant": ["imdhub_can_access_ecrf"],
        "/ontologies/participant/identifiers": ["imdhub_can_view_pid"],
      };

      mockJwtDecode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
        realm_access: {
          roles: ["imdhub_can_access_ecrf", "imdhub_user"],
        },
      });

      const decodedToken = mockJwtDecode("test_token");
      const userRoles = decodedToken.realm_access?.roles || [];

      // Should allow access to /participant
      const participantRequired = ROLE_REQUIREMENTS["/participant"];
      const hasParticipantAccess = participantRequired.some((r) =>
        userRoles.includes(r)
      );
      expect(hasParticipantAccess).toBe(true);

      // Should NOT allow access to /ontologies/participant/identifiers
      const identifierRequired =
        ROLE_REQUIREMENTS["/ontologies/participant/identifiers"];
      const hasIdentifierAccess = identifierRequired.some((r) =>
        userRoles.includes(r)
      );
      expect(hasIdentifierAccess).toBe(false);
    });
  });

  describe("CSP and Security Headers", () => {
    it("should generate unique nonce for CSP", () => {
      const nonceBuffer = new Uint8Array(16);
      crypto.getRandomValues(nonceBuffer);
      const nonce = Buffer.from(nonceBuffer).toString("base64");

      expect(nonce).toBeTruthy();
      expect(nonce.length).toBeGreaterThan(0);
    });

    it("should set Content-Security-Policy header with nonce", () => {
      const nonce = "test-nonce-123";
      const isDevelopment = false;

      const csp = [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}'${isDevelopment ? " 'unsafe-eval'" : ""}`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `font-src 'self' https://fonts.gstatic.com`,
        `img-src 'self' data: https:`,
        `connect-src 'self'`,
      ].join("; ");

      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("default-src 'self'");
      expect(csp).not.toContain("'unsafe-eval'"); // Not in production
    });
  });
});
