"use server";

import { PoolClient } from "pg";
import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";

/**
 * Insert a new row into a given schema.table
 * This API expects the request body to contain:
 * @param schema - The database schema (e.g., "imdhub_core").
 * @param tableName - The name of the table to insert data into.
 * @param data - The data to insert, which should include "biospecimen_id"
 *               and "visit_id".
 * @returns A promise that resolves to an object indicating success or failure.
 *          If successful, it returns { success: true, id: number }.
 *          If failed, it returns { success: false, message: string }.
 */

/** Quote an identifier (schema, table, or column) to prevent injection */
function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

/** Generate ID like: P12AB3 */
function generateCustomId(): string {
  const letters = Array.from({ length: 2 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  );
  const numbers = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 10).toString()
  );
  return `P${numbers[0]}${numbers[1]}${letters[0]}${letters[1]}${numbers[2]}`;
}

/** Check if identifier exists in the table */
async function identifierExists(
  client: PoolClient,
  schema: string,
  table: string,
  identifier: string
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM ${quoteIdent(schema)}.${quoteIdent(
      table
    )} WHERE identifier = $1 LIMIT 1;`,
    [identifier]
  );
  return rows.length > 0;
}

export async function bulkInsertIdentifiers(
  schema: string,
  tableName: string,
  baseData: Record<string, unknown>,
  count: number
): Promise<{ success: boolean; rowCount?: number; message?: string }> {
  const client = await pgPool.connect();

  try {
    // extract and validate clinical_site
    const site = baseData.clinical_site;

    if (!site || typeof site !== "number") {
      return {
        success: false,
        message: "Missing or invalid `clinical_site` value.",
      };
    }

    // check table exists (unchanged)...
    const { rows: existRows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2
       ) AS "exists";`,
      [schema, tableName]
    );

    // if table does not exist, return error
    if (!existRows[0]?.exists) {
      return {
        success: false,
        message: `Table "${schema}.${tableName}" does not exist.`,
      };
    }

    // set session and audit‐stamp values
    const user_email_session = await getUserEmailFromSession();
    const user_email = user_email_session[0] || "imdhub-system";
    const now = new Date().toISOString();

    // generate unique IDs
    const generatedData: Record<string, unknown>[] = [];
    const generatedIds = new Set<string>();
    let attempts = 0;
    while (generatedData.length < count && attempts < count * 10) {
      const id = generateCustomId();
      const exists = await identifierExists(client, schema, tableName, id);
      if (!exists && !generatedIds.has(id)) {
        generatedIds.add(id);
        generatedData.push({
          // columns to be inserted from the baseData
          clinical_site: site,
          identifier: id,
          created_by: user_email,
          created_at: now,
          updated_by: user_email,
          updated_at: now,
        });
      }
      attempts++;
    }
    if (generatedData.length < count) {
      return {
        success: false,
        message: `Only generated ${generatedData.length} of ${count} identifiers.`,
      };
    }

    // bulk insert all the rows in a single transaction
    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, user_email);
    for (const row of generatedData) {
      const cols = Object.keys(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const values = Object.values(row);
      const sql = `
        INSERT INTO ${quoteIdent(schema)}.${quoteIdent(tableName)}
          (${cols.map(quoteIdent).join(", ")})
        VALUES (${placeholders.join(", ")});
      `;
      await client.query(sql, values);
    }
    await client.query("COMMIT");
    return { success: true, rowCount: generatedData.length };
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const user_email_session = await getUserEmailFromSession();
    const user_email = user_email_session[0] || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: "BulkInsert:Identifiers",
        userId: user_email,
        resource: `${schema}.${tableName}`,
        metadata: { baseData, count },
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
