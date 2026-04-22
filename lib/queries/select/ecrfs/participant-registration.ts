import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildParticipantRegistrationsQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
      SELECT
        pr.*,
        pids.identifier  AS participant_id_code,
        cs.name          AS clinical_site_name,
        agb.name         AS gender_at_birth_name,
        coh.name         AS cohort_assignment_name,
        ds.name          AS disease_severity_name,
        diag.name        AS iembase_diagnoses_name,
        reg.name         AS registry_name,
        hei_pif.name     AS informed_consent_details_name,
        pcd.family_reference     AS pheno_family_reference,
        pcd.clinical_phenotype   AS pheno_clinical_phenotype,
        pcd.positive_hpos        AS pheno_positive_hpos,
        pcd.year_of_death        AS pheno_year_of_death,
        pcd.month_of_death       AS pheno_month_of_death,
        pcd.comment              AS pheno_comment,
        pcd_pdg.name             AS pheno_pedigree_name,
        pcd_cst.name             AS pheno_clinical_status_name,
        pcd_crs.name             AS pheno_case_resolution_status_name,
        pcd_ls.name              AS pheno_life_status_name,
        pcd_aos.name             AS pheno_age_at_onset_name,
        pcd_cons.name            AS pheno_consanguinity_name
      FROM ${quoteIdent(schema)}.participant_registrations AS pr
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
        ON pr.participant_id = pids.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pr.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.assigned_gender_at_birth AS agb
        ON pr.gender_at_birth = agb.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_cohorts AS coh
        ON pr.cohort_assignment = coh.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.diseases AS ds
        ON pr.disease_severity = ds.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.iembase_diagnoses AS diag
        ON pr.iembase_diagnoses = diag.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_registries AS reg
        ON pr.participant_data_registration = reg.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.heidelberg_pif_icf AS hei_pif
        ON pr.informed_consent_details = hei_pif.id
      LEFT JOIN ${quoteIdent(schema)}.participant_pheno_clinical_data AS pcd
        ON pr.participant_id = pcd.participant_identifier
        AND (pcd.soft_delete IS NULL OR pcd.soft_delete = false)
        AND (pcd.draft IS NULL OR pcd.draft = false)
      LEFT JOIN ${quoteIdent("imdhub_refs")}.pedigree AS pcd_pdg
        ON pcd.pedigree = pcd_pdg.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.clinical_status AS pcd_cst
        ON pcd.clinical_status = pcd_cst.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.case_resolution_status AS pcd_crs
        ON pcd.case_resolution_status = pcd_crs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.life_status AS pcd_ls
        ON pcd.life_status = pcd_ls.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.age_at_onset_of_symptoms AS pcd_aos
        ON pcd.age_at_onset = pcd_aos.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.consanguinity AS pcd_cons
        ON pcd.consanguinity = pcd_cons.id
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
      whereClauses.push(`pr.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`pr.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (pr.soft_delete IS NULL OR pr.soft_delete = false)
        AND (pr.draft IS NULL OR pr.draft = false)
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

  count: ({ schema, filters, groups }) => {
    let sql = `
      SELECT COUNT(DISTINCT pr.id) AS count
      FROM ${quoteIdent(schema)}.participant_registrations pr
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

    // Trashed only
    if (isTrashed) {
      whereClauses.push(`pr.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`pr.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (pr.soft_delete IS NULL OR pr.soft_delete = false)
        AND (pr.draft IS NULL OR pr.draft = false)
      `);
    } // ALL records do NOTHING

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

    // group-filter on clinical_site name
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
