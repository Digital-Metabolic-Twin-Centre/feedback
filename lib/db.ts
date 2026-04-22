import { Pool, PoolClient } from "pg";
import * as XLSX from "xlsx";
import { types } from "pg";
import { env } from "./env-validation";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";

/**
 * Global PostgreSQL connection pool
 */

// Make pg return timestamps as strings instead of auto-parsed JS Dates
types.setTypeParser(1114, (val) => val); // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, (val) => val); // TIMESTAMP WITH TIME ZONE

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

export const pgPool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 20, // up to 20 clients instead of the default 10
    idleTimeoutMillis: 30_000, // keep idle clients 30 s before closing
    connectionTimeoutMillis: 2000, // give up if a new client can’t connect in 2 s
    allowExitOnIdle: true, // in Next.js, lets lambda processes exit when idle
    ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });

if (!globalForPg.pgPool) {
  globalForPg.pgPool = pgPool;
}

/**
 * Returns an array of all the base tables in the given schema.
 *
 * @param schema - the name of the Postgres schema (e.g. "public" or "imdhub_refs")
 */
export async function listTablesInSchema(schema: string): Promise<string[]> {
  // You can call pool.query() directly if you don't need a client transaction
  const { rows } = await pgPool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type   = 'BASE TABLE'
      ORDER BY table_name;
    `,
    [schema]
  );

  return rows.map((r) => r.table_name);
}

/**
 * Returns an array of all the base tables in the given schema.
 *
 * @param schema - the name of the Postgres schema (e.g. "public" or "imdhub_refs")
 * @param sheetName - the name of the sheet to validate
 * @param sheet - the XLSX.WorkSheet object to validate
 */
export async function validateSheetColumns(
  client: PoolClient,
  schema: string,
  sheetName: string,
  sheet: XLSX.WorkSheet
): Promise<void> {
  // Extract header row
  const [headerRow] = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
  });
  if (!headerRow?.length) {
    throw new Error(`Sheet "${sheetName}" has no header row.`);
  }
  const headers = headerRow.map((h) => String(h).trim().toLowerCase());

  // Fetch actual columns
  const { rows } = await client.query<{ column_name: string }>(
    `
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name   = $2
    ORDER BY ordinal_position
    `,
    [schema, sheetName]
  );
  const tableCols = rows.map((r) => r.column_name.toLowerCase());

  // Compare columns and headers
  // - missingInTable: columns in the sheet that are not in the table
  const missingInTable = headers.filter((h) => !tableCols.includes(h));

  if (missingInTable.length) {
    const parts: string[] = [];
    if (missingInTable.length) {
      parts.push(
        `${missingInTable.join(
          ", "
        )} is not a valid column in "${sheetName}" table.`
      );
    }
    // - missingInSheet: columns in the table that are not in the sheet
    // throw new Error(
    //   `Column mismatch found in sheet "${sheetName}" ${parts.join("; ")}`
    // );
  }
}

/**
 * Inserts data from an XLSX.WorkSheet into a Postgres table.
 *
 * @param schema - the name of the Postgres schema (e.g. "public" or "imdhub_refs")
 * @param sheetName - the name of the sheet to insert data from, which should match the table name
 * @param sheet - the XLSX.WorkSheet object to insert
 */
export async function insertSheetData(
  client: PoolClient,
  schema: string,
  sheetName: string,
  sheet: XLSX.WorkSheet
): Promise<void> {
  // Extract data from the sheet
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
  });
  if (!rows.length) return;

  // Start a transaction
  await client.query("BEGIN");

  // Get the uploading user email from the session
  const user_email_session = await getUserEmailFromSession();
  const user_email = user_email_session[0] || "imdhub-system";

  try {
    // Re-load the exact column names (in ordinal order)
    const { rows: colRows } = await client.query<{ column_name: string }>(
      `
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name   = $2
         AND is_generated = 'NEVER'
    ORDER BY ordinal_position
    `,
      [schema, sheetName]
    );
    const columns = colRows
      .map((r) => r.column_name)
      .filter((col) => col !== "id" && col !== "search_vector");

    // Ensure created_by is filled
    if (columns.includes("created_by")) {
      rows.forEach((row) => {
        if (!row.created_by) {
          row.created_by = user_email;
        }
      });
    }

    // Check that all columns in the sheet are valid
    const values: unknown[] = [];
    const placeholders = rows
      .map((row, i) => {
        const rowPh = columns
          .map((col, j) => {
            values.push(row[col]);
            return `$${i * columns.length + j + 1}`;
          })
          .join(",");
        return `(${rowPh})`;
      })
      .join(",");

    const schemaId = quoteIdent(schema);
    const tableId = quoteIdent(sheetName);
    const colList = columns.map(quoteIdent).join(",");

    const sql = `
      INSERT INTO ${schemaId}.${tableId} (${colList})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING;
    `;

    try {
      await client.query(sql, values);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (insertError: any) {
      // Enhanced error message with column information
      if (insertError.code === '22P02') {
        const paramMatch = insertError.where?.match(/parameter \$(\d+)/);
        if (paramMatch) {
          const paramIndex = parseInt(paramMatch[1], 10) - 1;
          const rowIndex = Math.floor(paramIndex / columns.length);
          const colIndex = paramIndex % columns.length;
          const columnName = columns[colIndex];
          const value = values[paramIndex];

          throw new Error(
            `Invalid data type in sheet "${sheetName}":\n` +
            `Row: ${rowIndex + 2} (Excel row ${rowIndex + 2})\n` +
            `Column: "${columnName}"\n` +
            `Value: "${value}"\n` +
            `Error: Expected integer but got "${value}". ` +
            `This column likely requires an ID reference, not a text label.`
          );
        }
      }
      throw insertError;
    }

    // Commit the transaction
    await client.query("COMMIT");
  } catch (err) {
    console.error("Error inserting data:", err);
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Quotes an identifier (e.g. a column name) for use in a SQL query.
 *
 * @param id - the identifier to quote
 * @returns the quoted identifier
 */
function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}
