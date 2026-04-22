"use server";

import { pgPool } from "@/lib/db";
import { quoteIdent } from "@/lib/queries/helper";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";

/**
 * Read every row from a given schema.table
 * This API expects the request body to contain:
 * - "schema": The schema name (e.g., "imdhub_core").
 * - "tableName": The table name for the biospecimen logs.
 * - "filters": Optional filters to apply to the query.
 * - "groups": Optional groups to filter by.    

 * @param schema - The schema name (e.g., "imdhub_core").
 * @param tableName - The table name to read from.
 * @param filters - Optional filters to apply to the query.
 * @param groups - Optional groups to filter by.
 * @param req - The HTTP request object.
 * @param res - The HTTP response object.
 * 
 * @returns A JSON response indicating success or failure.
 */

/**
 * Read every row from a given schema.table
 */
export async function getTableData(
  schema: string,
  tableName: string,
  filters: Record<string, string> = {},
  groups: string[] = [],
  dateFilter?: { field: string; from?: string; to?: string }
): Promise<
  { success: true; data: unknown[] } | { success: false; message: string }
> {
  const client = await pgPool.connect();
  try {
    // Verify that table exists in this schema
    const { rows: existRows } = await client.query<{
      exists: boolean;
    }>(
      `
      SELECT EXISTS(
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name   = $2
      ) AS "exists";
    `,
      [schema, tableName]
    );

    let sql: string = "";
    const queryParams: unknown[] = [schema, tableName];
    queryParams.length = 0;

    if (
      !existRows[0]?.exists &&
      tableName !== "participant_registrations_analytics" &&
      tableName !== "iembase_diagnoses_explorer" &&
      tableName !== "shipping_template" &&
      tableName !== "v_available_aliquots"
    ) {
      console.error(`Table "${schema}.${tableName}" does not exist.`);
      // Refresh the page instead of returning error
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return "" as never;
    }

    /**
     * Build the SQL query based on the table name
     * and any filters or groups provided.
     * This is a simplified version
     * and may need to be extended for more complex tables.
     *
     * This function handles:
     * - `organisations`: Joins with organisation types and countries.
     * - `storage_temperatures`: Joins with biospecimen types.
     * - `participant_identifiers`: Joins with organisations and applies status/soft_delete filters
     * - `participant_registrations`: Joins with various reference tables for participant details.
     * - `participant_registration_analytics`: Similar to participant_registrations but for analytics so no grouping is applied.
     * - `participant_visits`: Joins with participant registrations and reference tables for visit details
     * - `biospecimen_logs`: Joins with participant visits and various reference tables for biospecimen log details.
     * - `shipments`: Joins with shipment status, organisations, shipment destinations, and aggregates biospecimen and aliquot details.
     * - `shipping_template`: Custom query to fetch biospecimen and aliquot details for shipping templates, with optional date filtering.
     * - `iembase_diagnoses_explorer`: Custom query to fetch iembase diagnoses with category counts and formatted fields.
     * - `off_study`: Joins with off_study_status, future_use_of_data, future_use_of_samples, and participant_identifiers.
     * - Other tables: Default select from the the ontologies tables.
     */
    if (tableName === "participant_registrations") {
      sql = `
        SELECT
          pr.id,
          pids.identifier  AS participant_id_code,
          cs.name          AS clinical_site_name         
        FROM ${quoteIdent(schema)}.participant_registrations AS pr
        LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
          ON pr.participant_id = pids.id
        LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations            AS cs
          ON pr.clinical_site = cs.id
      `;
      const whereClauses: string[] = [];

      // only strip out draft/trashed when call=visit_call
      if (filters.call === "visit_call") {
        whereClauses.push(`pr.soft_delete = false`);
        whereClauses.push(`COALESCE(pr.draft, false) = false`);
      }

      // group‐filter on clinical_site name
      if (groups.length > 0) {
        const ph = groups
          .map((_, i) => `$${queryParams.length + i + 1}`)
          .join(", ");
        whereClauses.push(`cs.name IN (${ph})`);
        queryParams.push(...groups);
      }

      // Append to your SQL
      if (whereClauses.length > 0) {
        sql += `\nWHERE ` + whereClauses.join("\n  AND ");
      }
    } else if (tableName === "participant_visits") {
      sql = `
        SELECT
          pv.visit_id

        FROM ${quoteIdent(schema)}.participant_visits AS pv
        LEFT JOIN ${quoteIdent(schema)}.participant_registrations AS pr
          ON pv.participant_id = pr.id
          AND pr.soft_delete = false
        LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
          ON pr.clinical_site = cs.id

      `;

      if (groups.length > 0) {
        const groupPlaceholders = groups
          .map((_, i) => `$${queryParams.length + i + 1}`)
          .join(", ");
        sql += ` WHERE cs.name IN (${groupPlaceholders})`;
        queryParams.push(...groups);
      }
    } else if (tableName === "biospecimen_logs") {
      sql = `
        SELECT
            bl.urine_aliquots_identifiers,
            bl.plasma_aliquots_identifiers,
            bl.frozen_pellets_aliquots_identifiers,
            bl.frozen_cryo_aliquots_identifiers
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
        `;

      if (groups.length > 0) {
        const groupPlaceholders = groups
          .map((_, i) => `$${queryParams.length + i + 1}`)
          .join(", ");
        sql += `WHERE cs.name IN (${groupPlaceholders})`;
        queryParams.push(...groups);
      }
    } else if (tableName === "shipments") {
      sql = `
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
            json_agg(ba.aliquot_identifier ORDER BY ba.aliquot_identifier)
                FILTER (WHERE ba.aliquot_identifier IS NOT NULL) AS aliquot_id
          FROM imdhub_core.shipments AS s
          LEFT JOIN imdhub_refs.shipment_status AS ss
            ON s.status = ss.id
          LEFT JOIN imdhub_refs.organisations AS org_from
            ON s.shipment_from = org_from.id
          LEFT JOIN imdhub_refs.shipment_destinations AS sd
            ON s.shipment_to = sd.id
          LEFT JOIN imdhub_core.shipment_items AS si
            ON si.shipment_id = s.id
          LEFT JOIN imdhub_core.biospecimen_aliquots AS ba
            ON ba.id = si.biospecimen_aliquot_id
          LEFT JOIN imdhub_core.biospecimen_logs AS bl
            ON bl.id = ba.biospecimen_log_id
            AND COALESCE(bl.soft_delete, false) = false
            AND COALESCE(bl.draft, false) = false
          LEFT JOIN imdhub_core.participant_visits AS pv
            ON bl.visit_id = pv.id
          LEFT JOIN imdhub_core.participant_registrations AS pr
            ON pv.participant_id = pr.id
             AND COALESCE(pr.soft_delete, false) = false
            AND COALESCE(pr.draft, false) = false
          LEFT JOIN imdhub_refs.organisations AS cs
            ON pr.clinical_site = cs.id
          `;

      if (groups.length > 0) {
        const groupPlaceholders = groups
          .map((_, i) => `$${queryParams.length + i + 1}`)
          .join(", ");
        sql += ` WHERE cs.name IN (${groupPlaceholders})`;
        queryParams.push(...groups);
      }

      sql += `
        GROUP BY
        s.id, ss.name, org_from.name, sd.name
      `;
    } else {
      // Default: no join
      sql = `SELECT * 
          FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
          ORDER BY "updated_at" DESC;`;
    }

    const result = await client.query(sql, queryParams);
    return { success: true, data: result.rows };
  } catch (err: unknown) {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Select:${tableName}`,
        userId: me,
        resource: `${schema}.${tableName}`,
        metadata: { filters, groups, dateFilter },
      },
      severity
    );

    return {
      success: false,
      message: getUserFriendlyMessage(err),
    };
  } finally {
    client.release();
  }
}
