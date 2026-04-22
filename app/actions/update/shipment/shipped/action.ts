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

function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

export async function MarkShipmentAsShippedOrReceived(
  schema: string,
  shipmentId: number,
  action: "mark_shipment_as_shipped" | "mark_shipment_as_received" = "mark_shipment_as_shipped"
): Promise<{ success: true } | { success: false; message: string }> {
  const client = await pgPool.connect();


  try {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    
    // Check authorization before proceeding with update
    // const authResult = await authorizeUpdateOperation(schema, "shipments", shipmentId);
    
    // if (!authResult.authorized) {
    //   return {
    //     success: false,
    //     message: authResult.reason,
    //   };
    // }
    
    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);

    const statusToSet = action === "mark_shipment_as_shipped"
      ? SHIPMENT_STATUS.SHIPMENT_PENDING        // before shipping
      : SHIPMENT_STATUS.SHIPMENT_MADE;          // before delivery

    // Load the dynamic ID for "Pending"
    const shippingStatusRes = await client.query(
      `
        SELECT id 
        FROM imdhub_refs.shipment_status
        WHERE name = $1
        LIMIT 1
      `,
      [statusToSet]
    );

    if (shippingStatusRes.rows.length === 0) {
      return { success: false, message: "Pending status not found in refs table." };
    }

    const shippingStatusId = shippingStatusRes.rows[0].id;

    // Load shipment
    const result = await client.query(
      `
        SELECT id, status
        FROM ${quoteIdent(schema)}.shipments
        WHERE id = $1
        LIMIT 1
      `,
      [shipmentId]
    );
    if (result.rows.length === 0) {
      return { success: false, message: "Shipment not found." };
    }

    if (result.rows[0].status !== shippingStatusId) {
      return { success: false, message: `Shipment is not in ${statusToSet} state.` };
    }



    // Load the dynamic ID for "Shipped" or "Received"
    const dynamicStatusToSet = action === "mark_shipment_as_shipped" ?
      SHIPMENT_STATUS.SHIPMENT_MADE : SHIPMENT_STATUS.SHIPMENT_RECEIVED;

    const shippedStatusRes = await client.query(
      `
        SELECT id 
        FROM imdhub_refs.shipment_status
        WHERE name = $1
        LIMIT 1
      `,
      [dynamicStatusToSet]
    );

    if (shippedStatusRes.rows.length === 0) {
      return { success: false, message: "Shipped status not found in refs table." };
    }

    const shippedStatusId = shippedStatusRes.rows[0].id;

    if (action === "mark_shipment_as_shipped") {
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
        FROM ${quoteIdent(schema)}.shipment_items si
        JOIN ${quoteIdent(schema)}.biospecimen_aliquots ba
          ON ba.id = si.biospecimen_aliquot_id
        JOIN ${quoteIdent(schema)}.biospecimen_logs bl
          ON bl.id = ba.biospecimen_log_id
        JOIN ${quoteIdent(schema)}.participant_visits pv
          ON pv.id = bl.visit_id
        JOIN ${quoteIdent(schema)}.participant_registrations pr
          ON pr.id = pv.participant_id
        LEFT JOIN imdhub_refs.participant_identifiers pid
          ON pid.id = pr.participant_id
        WHERE si.shipment_id = $1
          AND EXISTS (
            SELECT 1
            FROM ${quoteIdent(schema)}.off_study os
            WHERE os.participant_id = pr.id
              AND COALESCE(os.soft_delete, false) = false
              AND COALESCE(os.draft, false) = false
          )
        ORDER BY ba.aliquot_identifier
        `,
        [shipmentId]
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
          message: `Cannot mark shipment as shipped. Off-study participant aliquots detected: ${sample}`,
        };
      }
    }

    // Update shipment - shipped or received
    await client.query(
      `
        UPDATE ${quoteIdent(schema)}.shipments
        SET status = $1,
            updated_by = $2,
            updated_at = NOW(),
            draft = false,
            date_of_shipment = CURRENT_DATE
        WHERE id = $3
      `,
      [shippedStatusId, me, shipmentId]
    );

    await client.query("COMMIT");

    return { success: true };

  } catch (err: unknown) {
    await client.query("ROLLBACK");

    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: "MarkShipmentAsShippedOrReceived",
        userId: me,
        resource: `${schema}.shipments`,
        metadata: { shipmentId },
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
