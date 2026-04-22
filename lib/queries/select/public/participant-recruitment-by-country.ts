import { SelectQueryBuilder } from "@/lib/queries/types";

export const buildParticipantRecruitmentByCountryQuery: SelectQueryBuilder = {
  select: () => {
    const sql = `
      SELECT
        CASE
          WHEN c.name = 'United Kingdom of Great Britain and Northern Ireland (the)'
            THEN 'UK'
          WHEN c.name = 'Netherlands (the)'
            THEN 'Netherlands'
          ELSE c.name
        END AS country,
        COALESCE(COUNT(pr.id), 0)::int AS recruited_count
      FROM imdhub_refs.countries c
      LEFT JOIN imdhub_refs.organisations cs
        ON cs.country = c.id
      LEFT JOIN imdhub_core.participant_registrations pr
        ON pr.clinical_site = cs.id
        AND pr.soft_delete = false
        AND COALESCE(pr.draft, false) = false
        AND NOT EXISTS (
          SELECT 1
          FROM imdhub_core.off_study os
          WHERE os.participant_id = pr.id
            AND (COALESCE(os.soft_delete, false) = false)
            AND (COALESCE(os.draft, false) = false)
            AND os.withdraw_data = (
              SELECT id FROM imdhub_refs.future_use_of_data
              WHERE code = 'data_deleted'
              LIMIT 1
            )
        )
        
      WHERE c.name IN (
        'Germany',
        'Italy',
        'United Kingdom of Great Britain and Northern Ireland (the)',
        'Netherlands (the)',
        'Ireland',
        'Denmark',
        'Spain',
        'Czechia',
        'Belgium',
        'Austria',
        'Norway',
        'Sweden'
      )
      GROUP BY c.name
      ORDER BY recruited_count DESC, country
    `;


    return { sql, params: [] };
  },
};  