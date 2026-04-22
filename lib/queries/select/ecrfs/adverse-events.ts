import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const adverseEventsQuery: SelectQueryBuilder = {
  select: ({ filters, groups }) => {
    let sql = `
      SELECT
        ae.id,
        ae.participant_id,
        pid.identifier AS participant_id_code,
        ae.ae_number,
        ae.report_type,
        rt.name AS report_type_name,
        ae.follow_up,
        ae.ae_term,
        ae.ae_description,
        ae.severity_grade,
        sg.name AS severity_grade_name,
        ae.expectedness,
        exp.name AS expectedness_name,
        ae.ae_serious,
        ae.seriousness_criteria,
        sc.name AS seriousness_criteria_name,
        ae.date_of_sae_onset,
        ae.sae_end_date,
        ae.date_of_sae_awareness_at_site,
        ae.relationship_to_biopsy_procedure,
        rbp.name AS relationship_to_biopsy_procedure_name,
        ae.relationship_to_biopsy_device,
        rbd.name AS relationship_to_biopsy_device_name,
        ae.detail_the_treatment_given,
        ae.outcome,
        oc.name AS outcome_name,
        ae.sae_detail_action,
        ae.investigator_sign_off,
        ae.signature_date,
        ae.investigator_name,
        ae.draft,
        ae.created_by,
        ae.created_at,
        ae.updated_by,
        ae.updated_at,
        ae.soft_delete,
        cs.name AS clinical_site_name
      FROM imdhub_core.adverse_events AS ae
      LEFT JOIN imdhub_core.participant_registrations pr
        ON ae.participant_id = pr.id
      LEFT JOIN imdhub_refs.participant_identifiers pid
        ON pr.participant_id = pid.id
      LEFT JOIN imdhub_refs.organisations cs
          ON pr.clinical_site = cs.id
      LEFT JOIN imdhub_refs.report_type AS rt
        ON ae.report_type = rt.id
      LEFT JOIN imdhub_refs.severity_grade AS sg
        ON ae.severity_grade = sg.id
      LEFT JOIN imdhub_refs.expectedness AS exp
        ON ae.expectedness = exp.id
      LEFT JOIN imdhub_refs.seriousness_criteria AS sc
        ON ae.seriousness_criteria = sc.id
      LEFT JOIN imdhub_refs.relationship_to_biopsy AS rbp
        ON ae.relationship_to_biopsy_procedure = rbp.id
      LEFT JOIN imdhub_refs.relationship_to_biopsy AS rbd
        ON ae.relationship_to_biopsy_device = rbd.id
      LEFT JOIN imdhub_refs.outcome AS oc
        ON ae.outcome = oc.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`ae.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`ae.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (COALESCE(ae.soft_delete,false) = false)
        AND (COALESCE(ae.draft,false) = false)
      `);
    }// ALL do nothing

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

    // group filter
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
        FROM ${quoteIdent(schema)}.adverse_events t
        LEFT JOIN imdhub_core.participant_registrations pr
          ON t.participant_id = pr.id
          AND COALESCE(pr.soft_delete, false) = false
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
    }
    else if (isDraft) {
      whereClauses.push(`t.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (COALESCE(t.soft_delete,false) = false)
        AND (COALESCE(t.draft,false) = false)
      `);
    }// ALL do nothing

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

    // group filter
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += ` AND ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },
};
