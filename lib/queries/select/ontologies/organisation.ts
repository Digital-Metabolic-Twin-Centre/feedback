import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

export const buildOrganisationsQuery: SelectQueryBuilder = {
  select: ({ schema, filters }) => {
    if (!schema) {
      throw new Error("buildOrganisationsQuery requires schema");
    }

    let sql = `
      SELECT 
        orgs.*, 
        org_types.name AS organisation_type_name,
        country_names.name AS country_name
      FROM ${quoteIdent(schema)}.organisations AS orgs
      LEFT JOIN ${quoteIdent(schema)}.organisation_types AS org_types
        ON orgs.type = org_types.id
      LEFT JOIN ${quoteIdent(schema)}.countries AS country_names
        ON orgs.country = country_names.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";
    if (isTrashed) {
      whereClauses.push(`orgs.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`orgs.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (orgs.soft_delete IS NULL OR orgs.soft_delete = false)
        AND (orgs.draft IS NULL OR orgs.draft = false)
      `);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },
  count: ({ schema, filters }) => {
    if (!schema) {
      throw new Error("buildOrganisationsQuery requires schema");
    }

    let sql = `
      SELECT COUNT(*) AS count
      FROM ${quoteIdent(schema)}.organisations AS orgs
    `;

    const whereClauses: string[] = [];

    const isTrashed = filters?.soft_delete === "true";
    const isDraft = filters?.draft === "true";

    if (isTrashed) {
      whereClauses.push(`orgs.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`orgs.draft = true`);
    } else {
      whereClauses.push(`
        (orgs.soft_delete IS NULL OR orgs.soft_delete = false)
        AND (orgs.draft IS NULL OR orgs.draft = false)
      `);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params: [] };
  },
};