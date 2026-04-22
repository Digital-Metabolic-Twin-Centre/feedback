import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

export const buildIembaseDiagnosesExplorerQuery: SelectQueryBuilder = {
  select: () => {
    const sql = `
      WITH category_counts AS (
        SELECT 
          icimd_category,
          COUNT(*) AS category_count
        FROM imdhub_refs.iembase_diagnoses
        WHERE icimd_category IS NOT NULL
          AND imd_status != 'Gaucher cohort'
        GROUP BY icimd_category
      ),

      recruitment_counts AS (
        SELECT 
          iembase_diagnoses,
          COUNT(*) AS recruited_count
        FROM imdhub_core.participant_registrations pr
        WHERE soft_delete = false
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
        GROUP BY iembase_diagnoses
      ),

      recruitment_by_site AS (
        SELECT 
          pr.iembase_diagnoses,
          cs.name AS clinical_site_name,
          COUNT(*) AS recruited_by
        FROM imdhub_core.participant_registrations pr
        LEFT JOIN imdhub_refs.organisations cs
          ON pr.clinical_site = cs.id
        WHERE pr.soft_delete = false
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
        GROUP BY pr.iembase_diagnoses, cs.name
      )
        
      SELECT 
        diag.id,
        diag.name,
        diag.iembase_name,
        diag.code,
        diag.gene_symbol,
        diag.alternative_names,
        diag.icimd_category,
        diag.icimd_subcategory,
        diag.min_group_size AS recruitment_target,
        diag.imd_status,
        diag.number_of_collaborators,
        diag.collaborators,
        diag.targeted_urine,
        diag.global_plasma_complementary,
        diag.targeted_plasma,
        diag.global_plasma,
        diag.metabolite_biomarkers,
        diag.icimd_no,
        diag.omim_url,
        diag.iembase_url,

        COALESCE(rc.recruited_count, 0) AS recruited_count,

        COALESCE(
          jsonb_object_agg(rbs.clinical_site_name, rbs.recruited_by)
            FILTER (WHERE rbs.clinical_site_name IS NOT NULL),
          '{}'::jsonb
        ) AS recruited_by,

        cc.category_count,
        CONCAT(
          diag.icimd_category, 
          ' (', 
          cc.category_count, 
          ' IMDs)'
        ) AS formatted_category_header,

        ROW_NUMBER() OVER (
          PARTITION BY diag.icimd_category 
          ORDER BY diag.icimd_subcategory, diag.iembase_name
        ) AS category_row_number,

        diag.draft,
        diag.soft_delete,
        diag.created_at,
        diag.updated_at
      FROM ${quoteIdent("imdhub_refs")}.iembase_diagnoses AS diag
      LEFT JOIN category_counts cc
        ON diag.icimd_category = cc.icimd_category
      LEFT JOIN recruitment_counts rc
        ON diag.id = rc.iembase_diagnoses
      LEFT JOIN recruitment_by_site rbs
        ON diag.id = rbs.iembase_diagnoses
      WHERE diag.icimd_category IS NOT NULL
        AND diag.imd_status != 'Gaucher cohort'
      GROUP BY 
        diag.id, rc.recruited_count, cc.category_count
      ORDER BY 
        diag.icimd_category,
        diag.icimd_subcategory,
        diag.iembase_name
    `;

    return { sql, params: [] };
  },
};
