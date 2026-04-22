/* eslint-disable @typescript-eslint/no-unused-vars */

"use server";

import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";

function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

type PgError = Error & { code?: string };

export async function InsertContactWithAffiliations(
  schema: string,
  payload: Record<string, unknown>,
): Promise<
  { success: true; id: number } | { success: false; message: string }
> {
  const client = await pgPool.connect();

  try {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    /* eslint-disable @typescript-eslint/no-explicit-any */

    const rawAffiliations = (payload as any).affiliations;

    const affiliations: string[] = Array.isArray(rawAffiliations)
      ? rawAffiliations
          .map((a: any) => (typeof a === "string" ? a : a?.affiliation))
          .filter((x) => typeof x === "string")
      : [];

    const { affiliations: _unused, ...mainData } = payload;

    const now = new Date().toISOString();

    mainData.created_by = me;
    mainData.created_at = now;
    mainData.updated_by = me;
    mainData.updated_at = now;

    const cols = Object.keys(mainData);
    const vals = Object.values(mainData);
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    await client.query("BEGIN");
    // Must be inside the transaction so set_config(is_local=true) stays
    // visible to all DML (and therefore the audit trigger) within this tx.
    await setCurrentUserOnConnection(client, me);

    const insertSql = `
      INSERT INTO ${quoteIdent(schema)}.contacts
        (${cols.map(quoteIdent).join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id
    `;

    const insertRes = await client.query<{ id: number }>(insertSql, vals);
    const contactId = insertRes.rows[0].id;

    for (const aff of affiliations) {
      if (!aff?.trim()) continue;

      try {
        await client.query(
          `
          INSERT INTO ${quoteIdent(schema)}.contact_affiliations
            (contact_id, affiliation)
          VALUES ($1,$2)
          ON CONFLICT DO NOTHING
          `,
          [contactId, aff.trim()],
        );
      } catch (err: unknown) {
        if (!(err instanceof Error && (err as PgError).code === "23505")) {
          throw err;
        }
      }
    }

    await client.query("COMMIT");

    return { success: true, id: contactId };
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: "Insert:Contact",
        userId: me,
        resource: `${schema}.contacts`,
        metadata: { payload },
      },
      severity,
    );

    return {
      success: false,
      message: getUserFriendlyMessage(err),
    };
  } finally {
    client.release();
  }
}
