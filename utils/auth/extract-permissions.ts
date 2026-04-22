interface DecodedToken {
  realm_access?: { roles?: string[] };
  resource_access?: {
    [clientId: string]: {
      roles?: string[];
    };
  };
  groups?: string[];
}

export function extractUserPermissions(
  decodedAccessToken: DecodedToken,
  clientId: string
): {
  roles: string[];
  groups: string[];
} {
  const clientRoles =
    decodedAccessToken.resource_access?.[clientId]?.roles ?? [];

  const roles = clientRoles.filter((r) => r.startsWith("imdhub_"));

  const groups = (decodedAccessToken.groups ?? [])
    .filter((g) => g.startsWith("/CLINICAL SITES"))
    .map((g) => g.replace("/CLINICAL SITES/", ""));

  return { roles, groups };
}
