"use server";

/**
 * Returns user groups and roles from the session.
 * With Keycloak removed, all users are unauthenticated and receive empty arrays.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/auth/auth-options";

export async function getUserGroupsFromSession(): Promise<{
  roles: string[];
  groups: string[];
}> {
  const session = await getServerSession(authOptions);

  return {
    roles: Array.isArray(session?.roles) ? session.roles : [],
    groups: Array.isArray(session?.groups) ? session.groups : [],
  };
}
