"use server";

import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { quoteIdent } from "@/lib/queries/helper";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { authorizeDeleteOperation } from "@/lib/authorisation/delete-authorization";

/**
 * Soft-delete (trash) or hard-delete one or more rows in a given schema.table.
 *
 * @param schema     - the target schema
 * @param tableName  - the target table
 * @param where      - an object of column:value pairs to match rows
 */

type PgError = Error & { code?: string };

export async function deleteTableData(
  schema: string,
  tableName: string,
  where: Record<string, unknown>,
  restoreAction: string
): Promise<
  | { success: true; action: "trashed"; rowCount: number }
  | { success: true; action: "restore"; rowCount: number }
  | { success: true; action: "deleted"; rowCount: number }
  | { success: false; message: string }
> {
  const client = await pgPool.connect();
  try {
    // Ensure the table exists
    const { rows: existRows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2
       ) AS "exists"`,
      [schema, tableName]
    );
    if (!existRows[0]?.exists) {
      return {
        success: false,
        message: `Table "${schema}.${tableName}" does not exist.`,
      };
    }

    // Determine the action type
    const action = restoreAction === "Restore" ? "restore" :
      restoreAction === "Trash" ? "trash" : "delete";

    // Extract record ID for authorization
    const recordId =
      typeof where?.id === "string" || typeof where?.id === "number"
        ? where.id
        : undefined;
    if (recordId === undefined || String(recordId).trim() === "") {
      return {
        success: false,
        message: "Invalid delete request: where.id is required.",
      };
    }

    const authResult = await authorizeDeleteOperation(
      schema,
      tableName,
      recordId,
      action
    );

    if (!authResult.authorized) {
      return {
        success: false,
        message: authResult.reason,
      };
    }

    if (Object.keys(where).length === 0) {
      return {
        success: false,
        message: "Full delete not allowed without explicit permission",
      };
    }

    // Get the authenticated user email and open a transaction so that
    // set_config('app.current_user_id', ..., true) (is_local = true) remains
    // visible to all DML within the same transaction and therefore to the
    // audit trigger.  Without BEGIN the setting expires after the single
    // set_config statement's implicit auto-transaction.
    const user_email_session = await getUserEmailFromSession();
    const user_email = user_email_session[0] || "imdhub-system";

    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, user_email);

    // turn your `where` object into SQL
    const whereKeys = Object.keys(where);
    const whereClauses = whereKeys.map(
      (col, i) => `${quoteIdent(col)} = $${i + 1}`
    );
    const whereValues = Object.values(where);

    // timestamp for update
    const now = new Date().toISOString();

    // attempt a soft-delete: mark soft_delete = true where it is currently false
    const softSql = `
      UPDATE ${quoteIdent(schema)}.${quoteIdent(tableName)}
      SET 
        soft_delete = TRUE,
        updated_by   = $${whereKeys.length + 1},
        updated_at   = $${whereKeys.length + 2}
      WHERE ${whereClauses.join(" AND ")}
        AND (soft_delete IS FALSE OR soft_delete IS NULL)
    `;
    const softResult = await client.query(softSql, [
      ...whereValues,
      user_email,
      now,
    ]);

    const rowCount = softResult.rowCount ?? 0;
    if (rowCount > 0) {
      await client.query("COMMIT");
      return {
        success: true,
        action: "trashed",
        rowCount,
      };
    }

    if (restoreAction === "Restore") {
      // if the action is to restore, we need to set soft_delete = false
      const restoreSql = `
        UPDATE ${quoteIdent(schema)}.${quoteIdent(tableName)}
        SET
          soft_delete = FALSE,
          updated_by   = $${whereKeys.length + 1},
          updated_at   = $${whereKeys.length + 2}
        WHERE ${whereClauses.join(" AND ")}
          AND soft_delete = TRUE
      `;
      const restoreResult = await client.query(restoreSql, [
        ...whereValues,
        user_email,
        now,
      ]);

      const rowCount = restoreResult.rowCount ?? 0;
      if (rowCount > 0) {
        await client.query("COMMIT");
        return {
          success: true,
          action: "restore",
          rowCount,
        };
      }
    }

    // if nothing was just trashed, hard-delete all matching rows that are already trashed
    const delSql = `
      DELETE FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
      WHERE ${whereClauses.join(" AND ")}
        AND soft_delete = TRUE
    `;
    const delResult = await client.query(delSql, whereValues);
    await client.query("COMMIT");

    return {
      success: true,
      action: "deleted",
      rowCount: delResult.rowCount!,
    };
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => { });
    // Foreign key violation (safe to handle explicitly)
    if (err instanceof Error && (err as PgError).code === "23503") {
      return {
        success: false,
        message:
          "Delete failed due to existing related records. Please remove any dependent data before trying again.",
      };
    }

    // Structured error logging
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Delete:${tableName}`,
        userId: me,
        resource: `${schema}.${tableName}`,
        metadata: { where, restoreAction },
      },
      severity
    );

    return {
      success: false,
      message: getUserFriendlyMessage(err),
    };
  } finally {
    client.release();
  }
}
