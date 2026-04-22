import { SelectQueryBuilder } from "@/lib/queries/types";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildShippingTemplateQuery: SelectQueryBuilder = {
  select: ({ groups, dateFilter }) => {
    let sql = `
    SELECT 
      ba.aliquot_identifier AS aliquot_id,
      NULL::text AS box_position,
      NULL::text AS box_id
    FROM imdhub_core.biospecimen_logs bl
    JOIN imdhub_core.v_available_aliquots ba
      ON ba.biospecimen_log_id = bl.id
    JOIN imdhub_core.participant_visits pv
      ON bl.visit_id = pv.id
    JOIN imdhub_core.participant_registrations pr
      ON pv.participant_id = pr.id
      AND COALESCE(pr.soft_delete, false) = false
      AND COALESCE(pr.draft, false) = false
    JOIN imdhub_refs.organisations org
      ON pr.clinical_site = org.id
    WHERE COALESCE(bl.soft_delete, false) = false
      AND COALESCE(bl.draft, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM imdhub_core.off_study os
        WHERE os.participant_id = pr.id
          AND COALESCE(os.soft_delete, false) = false
          AND COALESCE(os.draft, false) = false
      )
  `;

    const params: unknown[] = [];

    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const groupPlaceholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      sql += ` AND org.name IN (${groupPlaceholders})`;
      params.push(...groups);
    }

    const allowedDateFields = new Set(["created_at", "updated_at"]);

    if (dateFilter?.field && !allowedDateFields.has(dateFilter.field)) {
      throw new Error(`Invalid date filter field: ${dateFilter.field}`);
    }

    const field = dateFilter?.field || "created_at";

    if (dateFilter?.from) {
      sql += ` AND bl.${field} >= $${params.length + 1}`;
      params.push(dateFilter.from);
    }

    if (dateFilter?.to) {
      const endOfDay = new Date(dateFilter.to);
      endOfDay.setHours(23, 59, 59, 999);
      sql += ` AND bl.${field} <= $${params.length + 1}`;
      params.push(endOfDay.toISOString());
    }

    sql += `
    ORDER BY ba.aliquot_identifier
  `;

    return { sql, params };
  },
};
