// 

import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

export const buildStorageTemperaturesQuery: SelectQueryBuilder = {
  select: ({ schema, filters }) => {
    if (!schema) {
      throw new Error("buildStorageTemperaturesQuery requires schema");
    }

    let sql = `
      SELECT 
        storg.*, 
        biospec.name AS biospecimen_type_name
      FROM ${quoteIdent(schema)}.storage_temperatures AS storg
      LEFT JOIN ${quoteIdent(schema)}.biospecimen_types AS biospec
        ON storg.biospecimen_type = biospec.id
    `;

    const whereClauses: string[] = [];

    const isTrashed = filters?.soft_delete === "true";
    const isDraft = filters?.draft === "true";

    if (isTrashed) {
      whereClauses.push(`storg.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`storg.draft = true`);
    } else {
      whereClauses.push(`
        (storg.soft_delete IS NULL OR storg.soft_delete = false)
        AND (storg.draft IS NULL OR storg.draft = false)
      `);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    sql += `\nORDER BY storg.updated_at DESC`;

    return { sql, params: [] };
  },

  count: ({ schema, filters }) => {
    if (!schema) {
      throw new Error("buildStorageTemperaturesQuery requires schema");
    }

    let sql = `
      SELECT COUNT(*) AS count
      FROM ${quoteIdent(schema)}.storage_temperatures AS storg
    `;

    const whereClauses: string[] = [];

    const isTrashed = filters?.soft_delete === "true";
    const isDraft = filters?.draft === "true";

    if (isTrashed) {
      whereClauses.push(`storg.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`storg.draft = true`);
    } else {
      whereClauses.push(`
        (storg.soft_delete IS NULL OR storg.soft_delete = false)
        AND (storg.draft IS NULL OR storg.draft = false)
      `);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params: [] };
  },
};
