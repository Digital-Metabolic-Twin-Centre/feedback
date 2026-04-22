/* eslint-disable */

// MUST be first before imports that use env
jest.mock("@/lib/env-validation", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    KEYCLOAK_CLIENT_ID: "dummy",
    KEYCLOAK_DOMAIN: "http://dummy",
    KEYCLOAK_JWKS_URI: "http://dummy",
    KEYCLOAK_CLIENT_SECRET: "dummy",
    NEXTAUTH_URL: "http://localhost:3000",
    CENTRAL_RESOURCES_FOLDER_ID: "dummy",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "dummy@example.com",
    GOOGLE_PRIVATE_KEY: "dummy",
    GITLAB_ISSUES_REPORTING_TOKEN: "dummy",
    GITLAB_REPORTING_PROJECT_ID: "123",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_USER: "user@example.com",
    SMTP_PASS: "password",
    SMTP_FROM: "no-reply@example.com",
  },
}));

jest.mock("@/lib/auth-audit", () => ({
  auditAuthEvent: jest.fn(),
}));

jest.mock("next-auth/jwt", () => ({
  __esModule: true,
  getToken: jest.fn(),
}));

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/utils/auth/get-user-server-session", () => ({
  getUserEmailFromSession: jest.fn(async () => []),
}));

jest.mock("@/lib/send-admin-notification", () => ({
  sendAdminNotification: jest.fn().mockResolvedValue(undefined),
}));


import { authOptions } from "@/utils/auth/auth-options";
import { encrypt } from "@/utils/auth/encryption";
import { jwtDecode } from "jwt-decode";

// Mock dependencies
jest.mock("@/utils/auth/encryption");
jest.mock("jwt-decode");

const mockEncrypt = encrypt as jest.MockedFunction<typeof encrypt>;
const mockJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;

// Helpers
const nowSec = () => Math.floor(Date.now() / 1000);

const TEST_SID = "kc-session-123";

function mockDecodedToken({
  exp = nowSec() + 3600,
  realmRoles = [],
  clientId = "dummy",
  clientRoles = [],
  groups = [],
}: {
  exp?: number;
  realmRoles?: string[];
  clientId?: string;
  clientRoles?: string[];
  groups?: string[];
}) {
  return {
    exp,
    realm_access: { roles: realmRoles },
    resource_access: {
      [clientId]: { roles: clientRoles },
      account: { roles: ["manage-account"] },
    },
    groups,
  };
}

type TokenEntry = { access_token: string; id_token: string };

/** Populate the server-side token store that auth-options uses. */
function setupTokenStore(
  sid: string,
  accessToken: string = "access_token",
  idToken: string = "id_token"
) {
  const store = (globalThis as any).__tokenStore as Map<string, TokenEntry> | undefined;
  if (store) store.set(sid, { access_token: accessToken, id_token: idToken });
}

describe("authOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEncrypt.mockImplementation((value) => `encrypted_${value}`);
    // Clear the token store between tests to prevent state leakage
    const store = (globalThis as any).__tokenStore as Map<string, unknown> | undefined;
    if (store) store.clear();
  });

  describe("callbacks.jwt", () => {
    it("stores raw tokens in tokenStore and caches decoded roles/groups in JWT on initial login", async () => {
      const mockAccount = {
        access_token: "mock_access_token",
        id_token: "mock_id_token",
        session_state: TEST_SID,
      };

      mockJwtDecode.mockReturnValue(
        mockDecodedToken({
          realmRoles: ["offline_access"],
          clientRoles: ["imdhub_admin", "imdhub_user"],
          groups: ["/CLINICAL SITES/Site A"],
        }) as any
      );

      const token = { sub: "user123" };

      const result = await authOptions.callbacks!.jwt!({
        token,
        account: mockAccount as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      // Raw tokens must be in tokenStore, NOT in the JWT cookie
      const stored = (globalThis as any).__tokenStore?.get(TEST_SID);
      expect(stored).toEqual({
        access_token: "mock_access_token",
        id_token: "mock_id_token",
      });
      expect((result as any).access_token).toBeUndefined();
      expect((result as any).id_token).toBeUndefined();
      expect((result as any).decoded).toBeUndefined();

      // Decoded roles/groups and exp are cached in the JWT for Edge middleware
      expect(result).toMatchObject({
        exp: expect.any(Number),
        roles: ["imdhub_admin", "imdhub_user"],
        groups: ["Site A"],
      });
    });

    it("extracts exp from decoded access token", async () => {
      const mockAccount = {
        access_token: "mock_access_token",
        id_token: "mock_id_token",
        session_state: TEST_SID,
      };

      const exp = nowSec() + 3600;
      mockJwtDecode.mockReturnValue(
        mockDecodedToken({ exp, realmRoles: [], clientRoles: [] }) as any
      );

      const token = { sub: "user123" };
      const result = await authOptions.callbacks!.jwt!({
        token,
        account: mockAccount as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      expect(result.exp).toBe(exp);
    });

    it("returns TokenExpired when existing token is expired", async () => {
      const expired = nowSec() - 10;

      const token = {
        sub: "user123",
        exp: expired,
        sid: TEST_SID,
      };
      setupTokenStore(TEST_SID, "expired_token");

      const result = await authOptions.callbacks!.jwt!({
        token: token as any,
        account: undefined as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      expect((result as any).error).toBe("TokenExpired");
      // Token store entry should be cleaned up on expiry
      expect((globalThis as any).__tokenStore?.get(TEST_SID)).toBeUndefined();
    });

    it("returns token unchanged when not expired and no new account", async () => {
      const future = nowSec() + 3600;

      const token = {
        sub: "user123",
        exp: future,
        sid: TEST_SID,
        roles: ["imdhub_user"],
        groups: [],
      };

      const result = await authOptions.callbacks!.jwt!({
        token: token as any,
        account: undefined as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      expect(result).toEqual(token);
    });

    it("handles token decode errors gracefully", async () => {
      const mockAccount = {
        access_token: "invalid_token",
        id_token: "mock_id_token",
      };

      mockJwtDecode.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const token = { sub: "user123" };

      await authOptions.callbacks!.jwt!({
        token: token as any,
        account: mockAccount as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Token validation error");

      consoleErrorSpy.mockRestore();
    });

    it("handles missing realm_access/resource_access in decoded token", async () => {
      const mockAccount = {
        access_token: "mock_access_token",
        id_token: "mock_id_token",
        session_state: TEST_SID,
      };

      mockJwtDecode.mockReturnValue({ exp: nowSec() + 3600 } as any);

      const token = { sub: "user123" };

      const result = await authOptions.callbacks!.jwt!({
        token: token as any,
        account: mockAccount as any,
        user: undefined as any,
        trigger: undefined as any,
        isNewUser: undefined as any,
        session: undefined as any,
      });

      expect((result as any).roles).toEqual([]);
      expect((result as any).groups).toEqual([]);
    });
  });

  describe("callbacks.session", () => {
    it("encrypts tokens before storing in session", async () => {
      setupTokenStore(TEST_SID, "plain_access_token", "plain_id_token");
      mockJwtDecode.mockReturnValue({ exp: nowSec() + 3600 } as any);

      const token = {
        sub: "user123",
        sid: TEST_SID,
        exp: nowSec() + 3600,
      };

      const session = {
        user: { name: "Test User", email: "test@example.com" },
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect(encrypt).toHaveBeenCalledWith("plain_access_token");
      expect(encrypt).toHaveBeenCalledWith("plain_id_token");
      expect((result as any).access_token).toBe("encrypted_plain_access_token");
      expect((result as any).id_token).toBe("encrypted_plain_id_token");
    });

    it("filters roles to include only imdhub_ prefixed roles from client_roles", async () => {
      setupTokenStore(TEST_SID, "token", "id_token");
      mockJwtDecode.mockReturnValue(
        mockDecodedToken({
          clientRoles: ["imdhub_admin", "imdhub_user", "other_role", "some_random_role"],
          groups: [],
        }) as any
      );

      const token = {
        sub: "user123",
        sid: TEST_SID,
        exp: nowSec() + 3600,
      };

      const session = {
        user: {},
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).roles).toEqual(["imdhub_admin", "imdhub_user"]);
    });

    it("clears session data when token is expired", async () => {
      const expired = nowSec() - 3600;
      setupTokenStore(TEST_SID, "expired_token", "expired_id");
      mockJwtDecode.mockReturnValue({ exp: expired } as any);

      const token = {
        sub: "user123",
        sid: TEST_SID,
        exp: expired,
      };

      const session = {
        user: {},
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).access_token).toBeUndefined();
      expect((result as any).id_token).toBeUndefined();
      expect((result as any).roles).toEqual([]);
      expect((result as any).groups).toEqual([]);
      expect((result as any).error).toBe("SessionExpired");
    });

    it("sets session expiration from decoded access token exp claim", async () => {
      const tokenExpiry = nowSec() + 3600;
      setupTokenStore(TEST_SID, "token", "id_token");
      mockJwtDecode.mockReturnValue({ exp: tokenExpiry } as any);

      const token = {
        sub: "user123",
        sid: TEST_SID,
        exp: tokenExpiry,
      };

      const session = {
        user: {},
        expires: new Date(Date.now() + 7200000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).expires).toBe(
        new Date(tokenExpiry * 1000).toISOString()
      );
    });

    it("uses default session expiration when token exp is missing", async () => {
      setupTokenStore(TEST_SID, "token", "id_token");
      mockJwtDecode.mockReturnValue({ exp: nowSec() + 3600 } as any);

      const token = {
        sub: "user123",
        sid: TEST_SID,
        // exp intentionally missing
      };

      const originalExpires = new Date(Date.now() + 3600000).toISOString();
      const session = {
        user: {},
        expires: originalExpires,
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).expires).toBe(originalExpires);
    });

    it("adds user id to session", async () => {
      setupTokenStore(TEST_SID, "token", "id_token");
      mockJwtDecode.mockReturnValue({ exp: nowSec() + 3600 } as any);

      const token = {
        sub: "user-uuid-123",
        sid: TEST_SID,
        exp: nowSec() + 3600,
      };

      const session = {
        user: { name: "Test" },
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).user?.id).toBe("user-uuid-123");
    });

    it("propagates token error to session", async () => {
      setupTokenStore(TEST_SID, "token", "id_token");
      mockJwtDecode.mockReturnValue({ exp: nowSec() + 3600 } as any);

      const token = {
        sub: "user123",
        sid: TEST_SID,
        exp: nowSec() + 3600,
        error: "SomeError",
      };

      const session = {
        user: {},
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const result = await authOptions.callbacks!.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        newSession: undefined as any,
        trigger: undefined as any,
      });

      expect((result as any).error).toBe("SomeError");
    });
  });

  describe("providers", () => {
    it("configures Keycloak provider", () => {
      const provider = authOptions.providers[0] as any;
      expect(provider).toBeDefined();
      expect(provider.id).toBe("keycloak");
    });

    it("requests correct OAuth scopes", () => {
      const provider = authOptions.providers[0] as any;
      expect(provider.options?.authorization).toEqual({
        params: { scope: "openid profile email" },
      });
    });
  });
});
