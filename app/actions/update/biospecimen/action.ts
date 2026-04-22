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

/** Safely quote an identifier (schema, table, or column) */
function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

/**
 * Update a biospecimen_logs row and its associated specimen-types in one transaction.
 *
 * @param schema - The schema name.
 * @param tableName - The table name for the biospecimen logs.
 * @param updates - The data to update in the log.
 * @param types - An array of specimen type IDs to associate with the log.
 * @returns A JSON response indicating success or failure.
 */

export async function UpdateBiospecimenLog(
  schema: string,
  tableName: string,
  updates: Record<string, unknown>,
  types: number[]
) {
  const client = await pgPool.connect();

  try {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    
    // Check authorization before proceeding with update
    const recordId = updates.id as number | string | undefined;
    
    if (recordId !== undefined && recordId !== null) {
      const authResult = await authorizeUpdateOperation(schema, tableName, recordId);
      
      if (!authResult.authorized) {
        return {
          success: false,
          message: authResult.reason,
        };
      }
    }
    
    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { specimen_type: _, ...logUpdates } = updates; // exclude the specimen_type from updates

    logUpdates.updated_at = new Date().toISOString();
    logUpdates.updated_by = me;

    const setCols = Object.keys(logUpdates).map((c, i) => `"${c}" = $${i + 1}`);
    const setValues = Object.values(logUpdates);
    const whereKey = "id"; //biospecimen primarykey since it does not change
    const whereVal = logUpdates.id as number;

    await client.query(
      `UPDATE ${quoteIdent(schema)}.${quoteIdent(tableName)}
     SET ${setCols.join(", ")}
   WHERE ${quoteIdent(whereKey)} = $${setValues.length + 1}`,
      [...setValues, whereVal]
    );

    // fetch the _numeric_ PK of that same row:
    const pkRes = await client.query<{ id: number }>(
      `SELECT id
     FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
    WHERE ${quoteIdent(whereKey)} = $1
    LIMIT 1`,
      [whereVal]
    );
    if (!pkRes.rowCount) throw new Error("Couldn’t find updated row’s id");
    const logId = pkRes.rows[0].id;

    // wipe and re-insert the M:N links by integer PK:
    await client.query(
      `DELETE FROM ${quoteIdent(schema)}.${quoteIdent(
        "biospecimen_logs_specimen_types"
      )}
   WHERE ${quoteIdent("biospecimen_log_id")} = $1`,
      [logId]
    );

    const insertSql = `
  INSERT INTO ${quoteIdent(schema)}.${quoteIdent(
      "biospecimen_logs_specimen_types"
    )}
    (${quoteIdent("biospecimen_log_id")}, ${quoteIdent("specimen_type_id")})
  VALUES ($1, $2)
  ON CONFLICT DO NOTHING
`;
    for (const t of types) {
      await client.query(insertSql, [logId, t]);
    }

    await client.query("COMMIT");
    return { success: true, rowCount: 1 };
  } catch (err) {
    await client.query("ROLLBACK");

    // Structured error logging
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Update:${tableName}`,
        userId: me,
        resource: `${schema}.${tableName}`,
        metadata: { updates, types },
      },
      severity
    );

    return { success: false, message: getUserFriendlyMessage(err) };
  } finally {
    client.release();
  }
}
