import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";


export const biospecimenLogsQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
      SELECT
        bl.*,
        vt.name AS visit_type_name,
        STRING_AGG(DISTINCT bt.name, ', ' ORDER BY bt.name) AS specimen_type_name,
        uc.name AS urine_collection_name,
        sp1.name AS urine_specimen_placed_name,
        sp2.name AS edta_blood_specimen_placed_name,
        al1.name AS urine_aliquots_collected_name,
        al2.name AS plasma_aliquots_collected_name,
        al3.name AS frozen_cryo_aliquots_collected_name,
        st1.name AS edta_blood_sample_stored_name,
        st2.name AS pax_gene_rna_sample_stored_name,
        fp.name AS fibroblast_provisions_name,
        at.name AS temp_of_aliquot_storage_name,
        to1.name AS outcome_of_testing_name,
        to2.name AS living_outcome_of_testing_name,
        to3.name AS cryo_outcome_of_testing_name,
        cs.name AS clinical_site_name
      FROM imdhub_core.biospecimen_logs AS bl
      LEFT JOIN imdhub_core.participant_visits AS pv
        ON bl.visit_id = pv.id
        AND COALESCE(pv.draft, false) = false
        AND COALESCE(pv.soft_delete, false) = false
      LEFT JOIN ${quoteIdent(schema)}.participant_registrations AS pr
        ON pv.participant_id = pr.id
        AND pr.soft_delete = false
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pr.clinical_site = cs.id
      LEFT JOIN imdhub_refs.visit_types AS vt
        ON pv.visit_type_id = vt.id
      LEFT JOIN imdhub_core.biospecimen_logs_specimen_types AS blst
        ON bl.id = blst.biospecimen_log_id
      LEFT JOIN imdhub_refs.biospecimen_types AS bt
        ON blst.specimen_type_id = bt.id
      LEFT JOIN imdhub_refs.urine_collection AS uc
        ON bl.mode_of_urine_collection = uc.id
      LEFT JOIN imdhub_refs.specimen_placed AS sp1
        ON bl.urine_specimen_placed = sp1.id
      LEFT JOIN imdhub_refs.specimen_placed AS sp2
        ON bl.edta_blood_specimen_placed = sp2.id
      LEFT JOIN imdhub_refs.aliquots AS al1
        ON bl.urine_aliquots_collected = al1.id
      LEFT JOIN imdhub_refs.aliquots AS al2
        ON bl.plasma_aliquots_collected = al2.id
      LEFT JOIN imdhub_refs.aliquots AS al3
        ON bl.frozen_cryo_aliquots_collected = al3.id
      LEFT JOIN imdhub_refs.storage_temperatures AS st1
        ON bl.edta_blood_sample_stored = st1.id
      LEFT JOIN imdhub_refs.storage_temperatures AS st2
        ON bl.pax_gene_rna_sample_stored = st2.id
      LEFT JOIN imdhub_refs.fibroblast_provisions AS fp
        ON bl.fibroblast_provisions = fp.id
      LEFT JOIN imdhub_refs.aliquots_temperature AS at
        ON bl.temp_of_aliquot_storage = at.id
      LEFT JOIN imdhub_refs.testing_outcome AS to1
        ON bl.outcome_of_testing = to1.id
      LEFT JOIN imdhub_refs.testing_outcome AS to2
        ON bl.living_outcome_of_testing = to2.id
      LEFT JOIN imdhub_refs.testing_outcome AS to3
        ON bl.cryo_outcome_of_testing = to3.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // Soft delete / draft filters
    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`bl.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`bl.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (bl.soft_delete IS NULL OR bl.soft_delete = false)
        AND (bl.draft IS NULL OR bl.draft = false)
      `);
    }
    // ALL records do NOTHING

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


    // group filter
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    // APPLY WHERE
    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    // ALWAYS group (because of STRING_AGG)
    sql += `
  GROUP BY
    bl.id, vt.name, uc.name, sp1.name, sp2.name, cs.name,
    al1.name, al2.name, al3.name, st1.name, st2.name,
    fp.name, at.name, to1.name, to2.name, to3.name
`;


    return { sql, params };
  },

  // counts
  count: ({ groups, filters }) => {
    let sql = `
    SELECT COUNT(DISTINCT bl.id) AS count
    FROM imdhub_core.biospecimen_logs bl
    LEFT JOIN imdhub_core.participant_visits pv
      ON bl.visit_id = pv.id
    LEFT JOIN imdhub_core.participant_registrations pr
      ON pv.participant_id = pr.id
    LEFT JOIN imdhub_refs.organisations cs
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
      whereClauses.push(`bl.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`bl.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (bl.soft_delete IS NULL OR bl.soft_delete = false)
        AND (bl.draft IS NULL OR bl.draft = false)
      `);
    }
    // ALL records do NOTHING

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