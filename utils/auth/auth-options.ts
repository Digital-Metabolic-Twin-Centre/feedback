import { NextAuthOptions } from "next-auth";

// No authentication providers — all users access the app anonymously.
// Authentication via Keycloak has been removed; only the feedback section
// remains active and is fully accessible without login.

export const authOptions: NextAuthOptions = {
  providers: [],
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
};
