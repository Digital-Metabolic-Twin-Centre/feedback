import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

export const defaultSelectQuery: SelectQueryBuilder = {

  select: ({ schema, tableName, filters }) => {
    if (!schema || !tableName) {
      throw new Error("defaultSelectQuery requires schema and tableName");
    }

    const whereClauses: string[] = [];

    // generic soft-delete handling ONLY
    if (filters?.soft_delete === "true") {
      whereClauses.push(`soft_delete = true`);
    } else if (filters?.draft === "true") {
      whereClauses.push(`draft = true`);
    } else {
      // default: active only
      whereClauses.push(
        `COALESCE(soft_delete, false) = false AND COALESCE(draft, false) = false`
      );
    }

    let sql = `
      SELECT *
      FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
    `;

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    sql += ` ORDER BY updated_at DESC`;

    return { sql, params: [] };
  },

  count: ({ schema, tableName, filters }) => {
    if (!schema || !tableName) {
      throw new Error("defaultSelectQuery requires schema and tableName");
    }

    const whereClauses: string[] = [];

    if (filters?.soft_delete === "true") {
      whereClauses.push(`soft_delete = true`);
    } else if (filters?.draft === "true") {
      whereClauses.push(`draft = true`);
    } else {
      whereClauses.push(
        `COALESCE(soft_delete, false) = false AND COALESCE(draft, false) = false`
      );
    }

    let sql = `
      SELECT COUNT(*) AS count
      FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
    `;

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    return { sql, params: [] };
  },
};
