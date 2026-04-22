import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildParticipantIdentifiersQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
      SELECT 
        p_ids.*, 
        orgs.name AS clinical_site_name
      FROM ${quoteIdent(schema)}.participant_identifiers AS p_ids
      LEFT JOIN ${quoteIdent(schema)}.organisations AS orgs
        ON p_ids.clinical_site = orgs.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // status / soft_delete filter
    if (filters.status === "Available" || filters.soft_delete === "false") {
      whereClauses.push(
        `p_ids.status = 'Available' AND p_ids.soft_delete = false`
      );
    }

    // group filter on orgs.name
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`orgs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },

  count: ({ schema, groups }) => {
    let sql = `
    SELECT COUNT(DISTINCT p_ids.id) AS count
    FROM ${quoteIdent(schema)}.participant_identifiers p_ids
    LEFT JOIN imdhub_refs.organisations orgs
      ON p_ids.clinical_site = orgs.id
  `;

    const params: unknown[] = [];

    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      sql += ` WHERE orgs.name = ANY($1)`;
      params.push(groups);
    }

    return { sql, params };
  },

};
