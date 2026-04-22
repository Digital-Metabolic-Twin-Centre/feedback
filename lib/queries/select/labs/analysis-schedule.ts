import { SelectQueryBuilder } from "@/lib/queries/types";

export const analysisScheduleQuery: SelectQueryBuilder = {
    select: () => {
        const sql = `
      SELECT
          bl.biospecimen_id,

          -- specimen types
          STRING_AGG(DISTINCT bt.name, ', ' ORDER BY bt.name) AS specimen_type,

          -- return aliquot identifiers 
          STRING_AGG(
            DISTINCT ba.aliquot_identifier, 
            ', ' ORDER BY ba.aliquot_identifier
          ) AS aliquot_identifier,

          cs.name AS clinical_site,
          ss.name AS shipment_status_name,

          diag.name AS disease_name,
          diag.metabolite_biomarkers,
          diag.targeted_urine_biomarkers,
          diag.targeted_plasma_biomarkers,
          diag.other_biomarkers,
          diag.targeted_urine,
          diag.targeted_plasma,
          diag.global_plasma,
          diag.global_plasma_complementary,
          diag.targeted_urine_volume,
          diag.targeted_plasma_volume,
          diag.global_plasma_volume,   
          diag.global_plasma_complementary_volume,
          diag.sample_allocation_strategy_version
      FROM imdhub_core.biospecimen_logs bl
      LEFT JOIN imdhub_core.participant_visits pv
          ON bl.visit_id = pv.id
      LEFT JOIN imdhub_core.participant_registrations pr
          ON pv.participant_id = pr.id
      LEFT JOIN imdhub_refs.organisations cs
          ON pr.clinical_site = cs.id

      -- specimen types
      LEFT JOIN imdhub_core.biospecimen_logs_specimen_types blst
          ON bl.id = blst.biospecimen_log_id
      LEFT JOIN imdhub_refs.biospecimen_types bt
          ON blst.specimen_type_id = bt.id

      -- disease + iembase metadata
      LEFT JOIN imdhub_refs.iembase_diagnoses diag
          ON pr.iembase_diagnoses = diag.id

      -- aliquots (shipments)
      LEFT JOIN imdhub_core.biospecimen_aliquots ba
          ON ba.biospecimen_log_id = bl.id
      LEFT JOIN imdhub_core.shipment_items si
          ON si.biospecimen_aliquot_id = ba.id
      LEFT JOIN imdhub_core.shipments s
          ON si.shipment_id = s.id
      LEFT JOIN imdhub_refs.shipment_status ss
          ON s.status = ss.id

      WHERE
          COALESCE(bl.soft_delete, false) = false
          AND COALESCE(bl.draft, false) = false

      GROUP BY
          bl.biospecimen_id,
          cs.name,
          diag.name,
          diag.imd_status,
          diag.metabolite_biomarkers,
          diag.targeted_urine,
          diag.global_plasma,
          diag.targeted_plasma,
          diag.targeted_urine_biomarkers,
          diag.targeted_plasma_biomarkers,
          diag.other_biomarkers,
          diag.targeted_urine_volume,
          diag.global_plasma_volume,
          diag.global_plasma_complementary_volume,
          diag.sample_allocation_strategy_version,  
          diag.targeted_plasma,
          diag.global_plasma_complementary,
          diag.targeted_plasma_volume,
          s.status,
          ss.name

      ORDER BY bl.biospecimen_id
    `;

        return { sql, params: [] };
    },

    count: ({ groups }) => {
        let sql = `
      SELECT COUNT(DISTINCT bl.biospecimen_id) AS count
      FROM imdhub_core.biospecimen_logs bl
      LEFT JOIN imdhub_core.participant_visits pv
        ON bl.visit_id = pv.id
      LEFT JOIN imdhub_core.participant_registrations pr
        ON pv.participant_id = pr.id
      LEFT JOIN imdhub_refs.organisations cs
        ON pr.clinical_site = cs.id
      WHERE COALESCE(bl.soft_delete, false) = false
        AND COALESCE(bl.draft, false) = false
    `;

        const params: unknown[] = [];

        if (groups.length > 0) {
            sql += ` AND cs.name = ANY($1)`;
            params.push(groups);
        }

        return { sql, params };
    },
};