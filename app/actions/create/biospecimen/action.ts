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

/**
 * Insert a new biospecimen log and link its specimen types.
 *
 * @param schema   DB schema (e.g. "imdhub_core")
 * @param payload  All form values, including payload.specimen_type: number[]
 * @returns        { success, id?, message? }
 */

export async function InsertBiospecimenLog(
  schema: string,
  payload: Record<string, unknown>
): Promise<
  { success: true; id: number } | { success: false; message: string }
> {
  const client = await pgPool.connect();
  try {
    // Auth / session user
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
    // Split off specimen_type array
    const rawSpecimen = (payload as any).specimen_type;
    const specimenTypeIds: number[] = Array.isArray(rawSpecimen)
      ? rawSpecimen.map((x) => Number(x))
      : [];
    const { specimen_type: _unused, ...mainData } = payload;
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

    // Build columns + values for the main insert
    const now = new Date().toISOString();
    mainData.created_by = me;
    mainData.created_at = now;
    mainData.updated_by = me;
    mainData.updated_at = now;

    const cols = Object.keys(mainData);
    const vals = Object.values(mainData);
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    // Run entire thing in one transaction.
    // setCurrentUserOnConnection must be inside BEGIN so set_config(is_local=true)
    // stays visible to all DML (and therefore the audit trigger) within this tx.
    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);

    //  Insert main row, get new ID
    const insertSql = `
      INSERT INTO ${quoteIdent(schema)}.biospecimen_logs
        (${cols.map(quoteIdent).join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id
    `;
    const insertRes = await client.query<{ id: number }>(insertSql, vals);
    const newLogId = insertRes.rows[0].id;

    //  Link specimen types
    for (const typeId of specimenTypeIds) {
      try {
        await client.query(
          `
            INSERT INTO ${quoteIdent(schema)}.biospecimen_logs_specimen_types
              (biospecimen_log_id, specimen_type_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [newLogId, typeId]
        );
      } catch (err: unknown) {
        // Ignore duplicate associations; bubble up other errors
        if (!(err instanceof Error && (err as PgError).code === "23505")) {
          throw err;
        }
      }
    }

    await client.query("COMMIT");
    return { success: true, id: newLogId };
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    if (err instanceof Error && (err as PgError).code === "23505") {
      const msg = err.message.includes("biospecimen_logs_biospecimen_id_key")
        ? "That Biospecimen ID already exists."
        : "Duplicate key error.";
      return { success: false, message: msg };
    }

    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: "Insert:BiospecimenLog",
        userId: me,
        resource: `${schema}.biospecimen_logs`,
        metadata: { payload },
      },
      severity
    );

    return { success: false, message: getUserFriendlyMessage(err) };
  } finally {
    client.release();
  }
}
