import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

export const buildParticipantRegistrationsAnalyticsQuery: SelectQueryBuilder = {
  select: ({ schema }) => {
    const sql = `
      SELECT
        pr.year_of_birth, 
        pr.month_of_birth,
        pids.identifier  AS participant_id_code,
        cs.name          AS clinical_site_name,
        agb.name         AS gender_at_birth_name,
        coh.name         AS cohort_assignment_name,
        ds.name          AS disease_severity_name,
        diag.name        AS iembase_diagnoses_name,
        diag.min_group_size AS minimum_recruitment_target,
        diag.imd_status  AS imd_status,
        reg.name         AS registry_name,
        hei_pif.name     AS informed_consent_details_name
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
      WHERE pr.soft_delete = false
        AND COALESCE(pr.draft, false) = false
        AND NOT EXISTS (
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
    `;

    return { sql, params: [] };
  },
};
