import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildOffStudyQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    const isSampleWithdrawalSource = filters.source === "labs_sample_withdrawal";

    let sql = `
      SELECT
        os.id,
        os.participant_id,
        pid.identifier AS participant_id_code,
        os.off_study_date,
        os.off_study_reason,
        reason.name AS off_study_reason_name,
        os.withdraw_data,
        fud.name    AS withdraw_data_name,
        os.withdraw_samples,
        fus.name    AS withdraw_samples_name,
        os.day_data_eliminated,
        os.day_sample_eliminated,
        os.who_eliminated_data,
        os.who_eliminated_sample,
        os.sample_confirmed,
        os.date_of_death,
        os.draft,
        os.comment,
        os.created_by,
        os.created_at,
        os.updated_by,
        os.updated_at,
        os.soft_delete,
        cs.name AS clinical_site_name
      FROM ${quoteIdent(schema)}.off_study AS os
      LEFT JOIN ${quoteIdent("imdhub_refs")}.off_study_status AS reason
        ON os.off_study_reason = reason.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.future_use_of_data AS fud
        ON os.withdraw_data = fud.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.future_use_of_samples AS fus
        ON os.withdraw_samples = fus.id
      LEFT JOIN imdhub_core.participant_registrations pr
        ON os.participant_id = pr.id

      LEFT JOIN imdhub_refs.participant_identifiers pid
        ON pr.participant_id = pid.id
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
      whereClauses.push(`os.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`os.draft = true`);
    } else if (isActive) {
      whereClauses.push(`
        (COALESCE(os.soft_delete,false) = false)
        AND (COALESCE(os.draft,false) = false)
      `);
    }// ALL do nothing

    if (isSampleWithdrawalSource) {
      whereClauses.push(`
        os.withdraw_samples IN (
          SELECT fus_filter.id
          FROM imdhub_refs.future_use_of_samples fus_filter
          WHERE COALESCE(fus_filter.soft_delete, false) = false
            AND (
              LOWER(COALESCE(fus_filter.name, '')) = LOWER('Samples to be destroyed')
              OR LOWER(COALESCE(fus_filter.label, '')) = LOWER('Samples to be destroyed')
              OR LOWER(COALESCE(fus_filter.code, '')) IN (
                'sample_destroyed',
                'samples_destroyed',
                'samples_to_be_destroyed'
              )
            )
        )
      `);
    }

    // group filter
    if (
      groups.length > 0 &&
      !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)
    ) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");

      if (isSampleWithdrawalSource) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM imdhub_core.participant_visits pv2
            JOIN imdhub_core.biospecimen_logs bl2
              ON bl2.visit_id = pv2.id
              AND COALESCE(bl2.soft_delete, false) = false
              AND COALESCE(bl2.draft, false) = false
            JOIN imdhub_core.biospecimen_aliquots ba2
              ON ba2.biospecimen_log_id = bl2.id
            JOIN imdhub_core.shipment_items si2
              ON si2.biospecimen_aliquot_id = ba2.id
            JOIN imdhub_core.shipments s2
              ON s2.id = si2.shipment_id
              AND COALESCE(s2.soft_delete, false) = false
              AND COALESCE(s2.draft, false) = false
            JOIN imdhub_refs.shipment_destinations sd2
              ON sd2.id = s2.shipment_to
            WHERE pv2.participant_id = os.participant_id
              AND sd2.name IN (${placeholders})
          )
        `);
      } else {
        whereClauses.push(`cs.name IN (${placeholders})`);
      }

      params.push(...groups);
    }


    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },
  count: ({ schema, groups, filters }) => {
    const isSampleWithdrawalSource = filters.source === "labs_sample_withdrawal";

    let sql = `
      SELECT COUNT(DISTINCT t.id) AS count
      FROM ${quoteIdent(schema)}.off_study t
      LEFT JOIN imdhub_refs.participant_identifiers pid
        ON t.participant_id = pid.id
      LEFT JOIN imdhub_core.participant_registrations pr
        ON pid.id = pr.participant_id
        AND COALESCE(pr.soft_delete, false) = false
      LEFT JOIN imdhub_refs.organisations cs
        ON pr.clinical_site = cs.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    // group filter
    if (
      groups.length > 0 &&
      !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)
    ) {
      if (isSampleWithdrawalSource) {
        sql += `
          AND EXISTS (
            SELECT 1
            FROM imdhub_core.participant_visits pv2
            JOIN imdhub_core.biospecimen_logs bl2
              ON bl2.visit_id = pv2.id
              AND COALESCE(bl2.soft_delete, false) = false
              AND COALESCE(bl2.draft, false) = false
            JOIN imdhub_core.biospecimen_aliquots ba2
              ON ba2.biospecimen_log_id = bl2.id
            JOIN imdhub_core.shipment_items si2
              ON si2.biospecimen_aliquot_id = ba2.id
            JOIN imdhub_core.shipments s2
              ON s2.id = si2.shipment_id
              AND COALESCE(s2.soft_delete, false) = false
              AND COALESCE(s2.draft, false) = false
            JOIN imdhub_refs.shipment_destinations sd2
              ON sd2.id = s2.shipment_to
            WHERE pv2.participant_id = t.participant_id
              AND sd2.name = ANY($${params.length + 1})
          )
        `;
      } else {
        sql += ` AND cs.name = ANY($${params.length + 1})`;
      }
      params.push(groups);
    }

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    if (isTrashed) {
      sql += ` AND t.soft_delete = true`;
    } else if (isDraft) {
      sql += ` AND t.draft = true`;
    } else if (isActive) {
      sql += `
        AND (COALESCE(t.soft_delete,false) = false)
        AND (COALESCE(t.draft,false) = false)
      `;
    }// ALL do nothing

    if (isSampleWithdrawalSource) {
      sql += `
        AND t.withdraw_samples IN (
          SELECT fus_filter.id
          FROM imdhub_refs.future_use_of_samples fus_filter
          WHERE COALESCE(fus_filter.soft_delete, false) = false
            AND (
              LOWER(COALESCE(fus_filter.name, '')) = LOWER('Samples to be destroyed')
              OR LOWER(COALESCE(fus_filter.label, '')) = LOWER('Samples to be destroyed')
              OR LOWER(COALESCE(fus_filter.code, '')) IN (
                'sample_destroyed',
                'samples_destroyed',
                'samples_to_be_destroyed'
              )
            )
        )
      `;
    }


    return { sql, params };
  },
};
