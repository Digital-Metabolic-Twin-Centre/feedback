/* eslint-disable @typescript-eslint/no-unused-vars */

"use server";

import { pgPool } from "@/lib/db";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { authorizeUpdateOperation } from "@/lib/authorisation/update-authorization";

function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

export async function UpdateContactWithAffiliations(
  schema: string,
  tableName: string,
  updates: Record<string, unknown>,
) {
  const client = await pgPool.connect();

  try {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    const recordId = updates.id as number | string | undefined;

    if (recordId !== undefined && recordId !== null) {
      const authResult = await authorizeUpdateOperation(
        schema,
        tableName,
        recordId,
      );

      if (!authResult.authorized) {
        return {
          success: false,
          message: authResult.reason,
        };
      }
    }

    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);

    /* extract affiliations */
    /* eslint-disable @typescript-eslint/no-explicit-any */

    const rawAffiliations = (updates as any).affiliations;

    const affiliations: string[] = Array.isArray(rawAffiliations)
      ? rawAffiliations
          .map((a: any) => (typeof a === "string" ? a : a?.affiliation))
          .filter((x) => typeof x === "string")
      : [];

    const { affiliations: _unused, ...contactUpdates } = updates;

    /* eslint-enable */

    contactUpdates.updated_at = new Date().toISOString();
    contactUpdates.updated_by = me;

    const setCols = Object.keys(contactUpdates).map(
      (c, i) => `${quoteIdent(c)} = $${i + 1}`,
    );

    const setValues = Object.values(contactUpdates);
    const whereKey = "id";
    const whereVal = contactUpdates.id as number;

    await client.query(
      `
      UPDATE ${quoteIdent(schema)}.${quoteIdent(tableName)}
      SET ${setCols.join(", ")}
      WHERE ${quoteIdent(whereKey)} = $${setValues.length + 1}
      `,
      [...setValues, whereVal],
    );

    /* get contact id */

    const pkRes = await client.query<{ id: number }>(
      `
      SELECT id
      FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
      WHERE ${quoteIdent(whereKey)} = $1
      LIMIT 1
      `,
      [whereVal],
    );

    if (!pkRes.rowCount) {
      throw new Error("Couldn’t find updated contact id");
    }

    const contactId = pkRes.rows[0].id;

    /* delete old affiliations */

    await client.query(
      `
      DELETE FROM ${quoteIdent(schema)}.${quoteIdent("contact_affiliations")}
      WHERE ${quoteIdent("contact_id")} = $1
      `,
      [contactId],
    );

    /* insert new affiliations */

    const insertSql = `
      INSERT INTO ${quoteIdent(schema)}.${quoteIdent("contact_affiliations")}
      (${quoteIdent("contact_id")}, ${quoteIdent("affiliation")})
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
    `;

    for (const aff of affiliations) {
      if (!aff?.trim()) continue;

      await client.query(insertSql, [contactId, aff.trim()]);
    }

    await client.query("COMMIT");

    return { success: true, rowCount: 1 };
  } catch (err) {
    await client.query("ROLLBACK");

    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Update:${tableName}`,
        userId: me,
        resource: `${schema}.${tableName}`,
        metadata: { updates },
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
