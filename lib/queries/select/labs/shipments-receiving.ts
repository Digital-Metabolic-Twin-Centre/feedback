import { SelectQueryBuilder } from "@/lib/queries/types";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";


/**
 * Shipments Receiving query
 * IMPORTANT:
 * - Always returns ACTIVE shipments only
 * - Draft and soft-deleted shipments are intentionally excluded
 * - Do NOT reuse for generic shipment listings
 */


export const buildShipmentsReceivingQuery: SelectQueryBuilder = {
  select: ({ groups }) => {
    let sql = `
    SELECT
        s.id,
        s.shipment_reference,
        s.status,
        s.shipment_from,
        s.shipment_to,
        ss.name AS status_name,
        org_from.name AS shipment_from_name,
        sd.name AS shipment_to_name,
        s.date_of_shipment,
        s.courier,
        s.courier_tracking_number,
        s.courier_url,
        s.shipment_received_by,
        s.date_of_shipment_received,
        s.comments,
        s.draft,
        s.soft_delete,
        s.created_by,
        s.created_at,
        s.updated_by,
        s.updated_at,
        json_agg(DISTINCT bl.id ORDER BY bl.id)
            FILTER (WHERE bl.id IS NOT NULL) AS biospecimen_id,
        json_agg(DISTINCT bl.biospecimen_id ORDER BY bl.biospecimen_id)
            FILTER (WHERE bl.biospecimen_id IS NOT NULL) AS biospecimen_code,
        json_agg(si.biospecimen_aliquot_id ORDER BY ba.aliquot_identifier)
            FILTER (WHERE si.biospecimen_aliquot_id IS NOT NULL) AS biospecimen_aliquot_ids,
        json_agg(lra.biospecimen_aliquot_id ORDER BY ba.aliquot_identifier)
            FILTER (WHERE lra.biospecimen_aliquot_id IS NOT NULL) AS lab_received_aliquot_ids,
        json_agg(ba.aliquot_identifier ORDER BY ba.aliquot_identifier)
            FILTER (WHERE ba.aliquot_identifier IS NOT NULL) AS aliquot_id,
        json_agg(ba.aliquot_identifier ORDER BY ba.aliquot_identifier)
          FILTER (WHERE lra.biospecimen_aliquot_id IS NOT NULL) AS aliquot_received_codes,
        json_agg(ba.aliquot_identifier ORDER BY ba.aliquot_identifier)
          FILTER (
              WHERE lra.biospecimen_aliquot_id IS NULL
              AND ba.aliquot_identifier IS NOT NULL
          ) AS aliquot_missing_codes,
        json_agg(
          jsonb_build_object(
            'aliquot_identifier', ba.aliquot_identifier,
            'aliquot_id', si.biospecimen_aliquot_id,
            'box_id', si.box_id,
            'box_position', si.box_position
          ) ORDER BY ba.aliquot_identifier
        ) FILTER (WHERE si.biospecimen_aliquot_id IS NOT NULL) AS shipment_items
      FROM imdhub_core.shipments AS s
      LEFT JOIN imdhub_refs.shipment_status AS ss
        ON s.status = ss.id
      LEFT JOIN imdhub_refs.organisations AS org_from
        ON s.shipment_from = org_from.id
      LEFT JOIN imdhub_refs.shipment_destinations AS sd
        ON s.shipment_to = sd.id
      LEFT JOIN imdhub_core.shipment_items AS si
        ON si.shipment_id = s.id
      LEFT JOIN imdhub_core.lab_received_aliquots AS lra
        ON lra.biospecimen_aliquot_id = si.biospecimen_aliquot_id
      LEFT JOIN imdhub_core.biospecimen_aliquots AS ba
        ON ba.id = si.biospecimen_aliquot_id
      LEFT JOIN imdhub_core.biospecimen_logs AS bl
        ON bl.id = ba.biospecimen_log_id
        AND COALESCE(bl.soft_delete, false) = false
        AND COALESCE(bl.draft, false) = false
      
  `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // Shipments Receiving MUST only show active shipments
    whereClauses.push(
      `COALESCE(s.soft_delete,false) = false AND COALESCE(s.draft,false) = false`
    );


    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");

      whereClauses.push(`sd.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    sql += `
    GROUP BY
      s.id, ss.name, org_from.name, sd.name
  `;

    return { sql, params };
  },
  count: ({ groups }) => {
    let sql = `
      SELECT COUNT(DISTINCT s.id) AS count
      FROM imdhub_core.shipments s
      LEFT JOIN imdhub_core.shipment_items si
        ON si.shipment_id = s.id
      LEFT JOIN imdhub_core.biospecimen_aliquots ba
        ON ba.id = si.biospecimen_aliquot_id
      LEFT JOIN imdhub_core.biospecimen_logs bl
        ON bl.id = ba.biospecimen_log_id
      LEFT JOIN imdhub_refs.shipment_destinations sd
        ON s.shipment_to = sd.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // Shipments Receiving MUST only show active shipments
    whereClauses.push(
      `COALESCE(s.soft_delete,false) = false AND COALESCE(s.draft,false) = false`
    );


    if (groups?.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      whereClauses.push(`sd.name = ANY($${params.length + 1})`);
      params.push(groups);
    }

    if (whereClauses.length) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },
};
