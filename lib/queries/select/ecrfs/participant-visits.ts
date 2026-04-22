import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildParticipantVisitsQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
      SELECT
        pv.*,
        pids.identifier AS participant_id_code,
        cs.name         AS clinical_site_name,
        vt.name         AS visit_type_name,
        pt.name         AS treatment_name,
        pr.cohort_assignment AS participant_cohort_assignment
      FROM ${quoteIdent(schema)}.participant_visits AS pv
      LEFT JOIN ${quoteIdent(schema)}.participant_registrations AS pr
        ON pv.participant_id = pr.id
        AND pr.soft_delete = false
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
        ON pr.participant_id = pids.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pr.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.visit_types AS vt
        ON pv.visit_type_id = vt.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_treatments AS pt
        ON pv.treatment_id = pt.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`pv.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`pv.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
      (pv.soft_delete IS NULL OR pv.soft_delete = false)
      AND (pv.draft IS NULL OR pv.draft = false)
    `);
    }
    // ALL records no state filter

    // Ensure we only include participants who are not off-study with data withdrawn
    whereClauses.push(`
      NOT EXISTS (
        SELECT 1
        FROM ${quoteIdent(schema)}.off_study os
        WHERE os.participant_id = pr.id
          AND (COALESCE(os.soft_delete, false) = false)
          AND (COALESCE(os.draft, false) = false)
          AND os.withdraw_data = (
            SELECT id FROM ${quoteIdent("imdhub_refs")}.future_use_of_data
            WHERE code = 'data_deleted'
            LIMIT 1
          )
      )
    `);

    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }


    return { sql, params };
  },

  // visit counts
  count: ({ schema, filters, groups }) => {
    let sql = `
      SELECT COUNT(DISTINCT pv.id) AS count
      FROM ${quoteIdent(schema)}.participant_visits pv
      LEFT JOIN ${quoteIdent(schema)}.participant_registrations pr
        ON pv.participant_id = pr.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations cs
        ON pr.clinical_site = cs.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`pv.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`pv.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
      (pv.soft_delete IS NULL OR pv.soft_delete = false)
      AND (pv.draft IS NULL OR pv.draft = false)
    `);
    }
    // ALL records no state filter

    // Ensure we only include participants who are not off-study with data withdrawn
    whereClauses.push(`
      NOT EXISTS (
        SELECT 1
        FROM ${quoteIdent(schema)}.off_study os
        WHERE os.participant_id = pr.id
          AND (COALESCE(os.soft_delete, false) = false)
          AND (COALESCE(os.draft, false) = false)
          AND os.withdraw_data = (
            SELECT id FROM ${quoteIdent("imdhub_refs")}.future_use_of_data
            WHERE code = 'data_deleted'
            LIMIT 1
          )
      )
    `);

    // Group filtering (clinical site names)
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },

};