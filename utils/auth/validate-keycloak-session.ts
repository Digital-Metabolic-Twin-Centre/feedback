import { env } from "@/lib/env-validation";


export async function isKeycloakSessionActive(accessToken: string): Promise<boolean> {
  const res = await fetch(`${env.KEYCLOAK_DOMAIN}/realms/your-realm/protocol/openid-connect/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.ok;
}
