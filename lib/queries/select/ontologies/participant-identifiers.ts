import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildParticipantIdentifiersQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
        SELECT 
          p_ids.id,
          p_ids.draft,
          p_ids.created_by,
          p_ids.created_at,
          p_ids.updated_by,
          p_ids.updated_at,
          p_ids.identifier,
          p_ids.clinical_site,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM imdhub_core.off_study os
              INNER JOIN imdhub_core.participant_registrations pr
                ON os.participant_id = pr.id
              WHERE pr.participant_id = p_ids.id
                AND (COALESCE(os.soft_delete, false) = false)
                AND (COALESCE(os.draft, false) = false)
                AND os.withdraw_data = (
                  SELECT id FROM ${quoteIdent("imdhub_refs")}.future_use_of_data
                  WHERE code = 'data_deleted'
                  LIMIT 1
                )
            ) THEN 'Withdrawn'
            ELSE p_ids.status
          END AS status,
          p_ids.soft_delete,
          p_ids.search_vector,
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
