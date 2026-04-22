import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const participantDataQueriesQuery: SelectQueryBuilder = {
  select: ({ filters, groups }) => {
    let sql = `
      SELECT
        q.id,
        q.participant_id,
        q.visit_id,
        pv.visit_id AS visit_id_code,
        pid.identifier AS participant_id_code,
        qt.name AS query_type_name,
        dmr.name AS data_manager_review_name,
        qs.name AS status_name,
        q.module_name,
        q.date_responded,
        q.responder_name,
        q.site_response,
        q.field_name,
        q.query_type,
        q.query_description,
        q.data_manager_review,
        q.date_closed,
        q.status,
        q.comments,
        q.query_id,
        q.draft,
        q.created_by,
        q.created_at,
        q.updated_by,
        q.updated_at,
        q.soft_delete,
        cs.name AS clinical_site_name
      FROM imdhub_core.participant_data_queries AS q
      LEFT JOIN imdhub_core.participant_registrations pr
        ON q.participant_id = pr.id
      LEFT JOIN imdhub_refs.participant_identifiers AS pid
        ON pr.participant_id = pid.id
      LEFT JOIN imdhub_refs.organisations cs
        ON pr.clinical_site = cs.id
      LEFT JOIN imdhub_core.participant_visits AS pv
        ON q.visit_id = pv.id
      LEFT JOIN imdhub_refs.query_types AS qt
        ON q.query_type = qt.id
      LEFT JOIN imdhub_refs.data_manager_review AS dmr
        ON q.data_manager_review = dmr.id
      LEFT JOIN imdhub_refs.query_status AS qs
        ON q.status = qs.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];
    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`q.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`q.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (COALESCE(q.soft_delete,false) = false)
        AND (COALESCE(q.draft,false) = false)
      `);
    }// ALL  do nothing

    // Ensure we only include participants who are not off-study with data withdrawn
    whereClauses.push(`
      NOT EXISTS (
        SELECT 1
        FROM ${quoteIdent("imdhub_core")}.off_study os
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

    // group-filter on clinical_site name
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },

  count: ({ schema, groups, filters }) => {
    let sql = `
    SELECT COUNT(DISTINCT t.id) AS count
    FROM ${quoteIdent(schema)}.participant_data_queries t
    LEFT JOIN imdhub_core.participant_registrations pr
      ON t.participant_id = pr.id
    LEFT JOIN imdhub_refs.participant_identifiers pid
      ON pr.participant_id = pid.id
    LEFT JOIN imdhub_refs.organisations cs
      ON pr.clinical_site = cs.id
    WHERE 1=1
  `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`t.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`t.draft = true`);
    } else if (isActive) {
      whereClauses.push(`
      (COALESCE(t.soft_delete,false) = false)
      AND (COALESCE(t.draft,false) = false)
    `);
    }

    whereClauses.push(`
    NOT EXISTS (
      SELECT 1
      FROM ${quoteIdent("imdhub_core")}.off_study os
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
      whereClauses.push(`cs.name = ANY($${params.length + 1})`);
      params.push(groups);
    }

    if (whereClauses.length > 0) {
      sql += `\n  AND ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },
};