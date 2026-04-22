"use server";

import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { SHIPMENT_STATUS } from "@/lib/constants";
// import { authorizeUpdateOperation } from "@/lib/authorisation/update-authorization";

/**
 * Update shipments table and shipment_items child table.
 * Handles updating shipment details and associated aliquots.
 */

function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

type PgError = Error & { code?: string };

export async function UpdateShipmentData(
  schema: string,
  id: number,
  payload: Record<string, unknown>
): Promise<
  { success: true; id: number } | { success: false; message: string }
> {
  const client = await pgPool.connect();
  try {
    // Auth / session user
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    // Extract shipment_items for child table
    // eslint-disable-next-line
    const rawShipmentItems = (payload as any).shipment_items;
    const shipmentItemIds: string[] = Array.isArray(rawShipmentItems)
      ? rawShipmentItems.filter((x) => x !== null && x !== undefined)
      : [];

    // Determine update mode (the form that is updating the shipments table)
    //eslint-disable-next-line
    const mode = (payload as any)._mode; // "tracking" | "receiving"


    // Whitelist allowed shipment columns
    const allowedCols = [
      "shipment_reference",
      "status",
      "shipment_from",
      "shipment_to",
      "date_of_shipment",
      "courier",
      "courier_tracking_number",
      "courier_url",
      "shipment_received_by",
      "date_of_shipment_received",
      "comments",
      "draft",
      "soft_delete",
      "created_by",
      "created_at",
      "updated_by",
      "updated_at",
    ];

    // Pick only allowed keys from payload
    // eslint-disable-next-line
    const mainData: Record<string, any> = {};
    for (const col of allowedCols) {
      if (payload[col] !== undefined) {
        mainData[col] = payload[col];
      }
    }

    // Add audit metadata
    const now = new Date().toISOString();
    mainData.updated_by = me;
    mainData.updated_at = now;

    const cols = Object.keys(mainData);
    const vals = Object.values(mainData);

    // Build SQL SET clause
    const setSql = cols
      .map((c, i) => `${quoteIdent(c)} = $${i + 1}`)
      .join(", ");

    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);
    if (cols.length > 0) {
      const updateSql = `
        UPDATE ${quoteIdent(schema)}.shipments
        SET ${setSql}
        WHERE id = $${cols.length + 1}
      `;
      await client.query(updateSql, [...vals, id]);
    }

    if (mode === SHIPMENT_STATUS.SHIPMENT_TRACKING_MODE_FORM) {
      if (shipmentItemIds.length > 0) {
        const offStudyRows = await client.query<{
          aliquot_identifier: string;
          participant_id_code: string | null;
          participant_registration_id: number;
        }>(
          `
          SELECT DISTINCT
            ba.aliquot_identifier,
            pid.identifier AS participant_id_code,
            pr.id AS participant_registration_id
          FROM ${quoteIdent(schema)}.biospecimen_aliquots ba
          JOIN ${quoteIdent(schema)}.biospecimen_logs bl
            ON bl.id = ba.biospecimen_log_id
          JOIN ${quoteIdent(schema)}.participant_visits pv
            ON pv.id = bl.visit_id
          JOIN ${quoteIdent(schema)}.participant_registrations pr
            ON pr.id = pv.participant_id
          LEFT JOIN imdhub_refs.participant_identifiers pid
            ON pid.id = pr.participant_id
          WHERE (ba.aliquot_identifier = ANY($1) OR ba.id::text = ANY($1))
            AND EXISTS (
              SELECT 1
              FROM ${quoteIdent(schema)}.off_study os
              WHERE os.participant_id = pr.id
                AND COALESCE(os.soft_delete, false) = false
                AND COALESCE(os.draft, false) = false
            )
          ORDER BY ba.aliquot_identifier
          `,
          [shipmentItemIds]
        );

        if (offStudyRows.rows.length > 0) {
          await client.query("ROLLBACK");
          const sample = offStudyRows.rows
            .slice(0, 3)
            .map(
              (r) =>
                `${r.aliquot_identifier} (${r.participant_id_code ?? `#${r.participant_registration_id}`})`
            )
            .join(", ");
          return {
            success: false,
            message: `Cannot update shipment. Off-study participant aliquots detected: ${sample}`,
          };
        }
      }

      // Reset shipment_items: delete existing, re-insert new
      await client.query(
        `DELETE FROM ${quoteIdent(schema)}.shipment_items WHERE shipment_id = $1`,
        [id]
      );

      for (const aliquotId of shipmentItemIds) {
        try {
          const biospecimenQuery = await client.query(
            `
          SELECT id AS aliquot_id, biospecimen_log_id AS biospecimen_id
          FROM ${quoteIdent(schema)}.biospecimen_aliquots
          WHERE aliquot_identifier = $1 OR id::text = $1
          LIMIT 1
        `,
            [aliquotId]
          );

          if (biospecimenQuery.rows.length === 0) {
            console.warn(`No biospecimen found for aliquot: ${aliquotId}`);
            continue;
          }

          const { aliquot_id, biospecimen_id } = biospecimenQuery.rows[0];

          await client.query(
            `
          INSERT INTO ${quoteIdent(schema)}.shipment_items
            (shipment_id, biospecimen_id, biospecimen_aliquot_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (shipment_id, biospecimen_aliquot_id) DO NOTHING
        `,
            [id, biospecimen_id, aliquot_id]
          );
        } catch (err: unknown) {
          if (!(err instanceof Error && (err as PgError).code === "23505")) {
            throw err;
          }
        }
      }
    }

    await client.query("COMMIT");
    return { success: true, id };
  } catch (err: unknown) {
    await client.query("ROLLBACK");
    if (err instanceof Error && (err as PgError).code === "23505") {
      const msg = err.message.includes("shipments_shipment_reference_key")
        ? "That Shipment Reference already exists."
        : "Duplicate key error.";
      return { success: false, message: msg };
    }
    // Structured error logging
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Update:Shipments`,
        userId: me,
        resource: `${schema}.shipments`,
        metadata: { id, payload },
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
