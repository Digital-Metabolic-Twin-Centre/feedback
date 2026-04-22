import { NextAuthOptions } from "next-auth";
import { jwtDecode } from "jwt-decode";
import { encrypt } from "@/utils/auth/encryption";
import { env } from "@/lib/env-validation";

type TokenStoreEntry = {
  access_token: string;
  id_token: string;
};

type DecodedAccessToken = {
  exp?: number;
  groups?: string[];
  resource_access?: Record<string, { roles?: string[] }>;
};

type TokenLike = {
  sub?: string;
  sid?: string;
  exp?: number;
  roles?: string[];
  groups?: string[];
  error?: string;
};

type AccountLike = {
  access_token?: string;
  id_token?: string;
  session_state?: string;
};

type SessionLike = {
  user?: {
    id?: string;
  };
  expires?: string;
  access_token?: string;
  id_token?: string;
  roles?: string[];
  groups?: string[];
  error?: string;
};

function getTokenStore(): Map<string, TokenStoreEntry> {
  const globalStore = globalThis as typeof globalThis & {
    __tokenStore?: Map<string, TokenStoreEntry>;
  };
  if (!globalStore.__tokenStore) {
    globalStore.__tokenStore = new Map<string, TokenStoreEntry>();
  }
  return globalStore.__tokenStore;
}

function extractGroups(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => {
      if (typeof group !== "string") return "";
      const normalized = group.replace(/^\/CLINICAL SITES\//i, "").trim();
      return normalized || group.trim();
    })
    .filter(Boolean);
}

function extractClientRoles(decoded: DecodedAccessToken): string[] {
  const resourceAccess = decoded.resource_access ?? {};
  const preferredClientId = env.KEYCLOAK_CLIENT_ID;
  const candidateKeys = preferredClientId
    ? [preferredClientId, ...Object.keys(resourceAccess).filter((key) => key !== preferredClientId)]
    : Object.keys(resourceAccess);
  const clientKey = candidateKeys.find((key) => key !== "account" && resourceAccess[key]);
  if (!clientKey) return [];

  const roles = resourceAccess[clientKey]?.roles ?? [];
  return roles.filter((role) => typeof role === "string" && role.startsWith("imdhub_"));
}

function isExpired(exp?: number): boolean {
  if (!exp || !Number.isFinite(exp)) return false;
  return exp <= Math.floor(Date.now() / 1000);
}

const testKeycloakProvider = {
  id: "keycloak",
  options: {
    authorization: {
      params: { scope: "openid profile email" },
    },
  },
} as const;

export const authOptions: NextAuthOptions = {
  providers: process.env.NODE_ENV === "test" ? [testKeycloakProvider as never] : [],
  callbacks: {
    async jwt({ token, account }) {
      const tokenStore = getTokenStore();
      const mutableToken = token as TokenLike;
      const loginAccount = account as AccountLike | null;

      if (loginAccount?.access_token) {
        try {
          const decoded = jwtDecode<DecodedAccessToken>(loginAccount.access_token);
          const sid = loginAccount.session_state || mutableToken.sid || mutableToken.sub || "anonymous";

          tokenStore.set(sid, {
            access_token: loginAccount.access_token,
            id_token: loginAccount.id_token ?? "",
          });

          return {
            ...mutableToken,
            sid,
            exp: decoded.exp,
            roles: extractClientRoles(decoded),
            groups: extractGroups(decoded.groups),
          };
        } catch {
          console.error("Token validation error");
          return mutableToken;
        }
      }

      if (isExpired(mutableToken.exp)) {
        if (mutableToken.sid) {
          tokenStore.delete(mutableToken.sid);
        }
        return { ...mutableToken, error: "TokenExpired" };
      }

      return mutableToken;
    },
    async session({ session, token }) {
      const tokenStore = getTokenStore();
      const sessionValue = session as SessionLike;
      const tokenValue = token as TokenLike;

      if (!sessionValue.user) {
        sessionValue.user = {};
      }
      if (tokenValue.sub) {
        sessionValue.user.id = tokenValue.sub;
      }

      if (tokenValue.error) {
        sessionValue.error = tokenValue.error;
      }

      if (isExpired(tokenValue.exp)) {
        if (tokenValue.sid) {
          tokenStore.delete(tokenValue.sid);
        }
        sessionValue.roles = [];
        sessionValue.groups = [];
        sessionValue.error = "SessionExpired";
        return sessionValue;
      }

      if (typeof tokenValue.exp === "number" && Number.isFinite(tokenValue.exp) && sessionValue.expires) {
        sessionValue.expires = new Date(tokenValue.exp * 1000).toISOString();
      }

      const stored = tokenValue.sid ? tokenStore.get(tokenValue.sid) : undefined;
      if (!stored || !stored.access_token) {
        sessionValue.roles = Array.isArray(tokenValue.roles) ? tokenValue.roles : [];
        sessionValue.groups = Array.isArray(tokenValue.groups) ? tokenValue.groups : [];
        return sessionValue;
      }

      try {
        sessionValue.access_token = encrypt(stored.access_token);
        sessionValue.id_token = encrypt(stored.id_token);

        const decoded = jwtDecode<DecodedAccessToken>(stored.access_token);
        sessionValue.roles = extractClientRoles(decoded);
        sessionValue.groups = extractGroups(decoded.groups);
      } catch {
        console.error("Token validation error");
        sessionValue.roles = [];
        sessionValue.groups = [];
      }

      return session;
    },
  },
};
