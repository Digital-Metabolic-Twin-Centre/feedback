"use server";

import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";

function quoteIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`;
}

type PgError = Error & { code?: string };

/**
 * Insert a new shipment and link its shipment items (aliquots).
 *
 * @param schema   DB schema (e.g. "imdhub_core")
 * @param payload  All form values, including payload.shipment_items: string[]
 * @returns        { success, id?, message? }
 */

export async function InsertShipmentData(
  schema: string,
  payload: Record<string, unknown>
): Promise<
  { success: true; id: number } | { success: false; message: string }
> {
  const client = await pgPool.connect();
  try {
    // Auth / session user
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";

    // Destructure out nested biospecimens, ignore old flat fields
    const {
      biospecimens = [],
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      shipment_items: _shipment_items,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      biospecimen_id: _biospecimen_id,
      ...mainData
    } =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload as any;

    // Add audit metadata
    const now = new Date().toISOString();
    mainData.created_by = me;
    mainData.created_at = now;
    mainData.updated_by = me;
    mainData.updated_at = now;

    const cols = Object.keys(mainData);
    const vals = Object.values(mainData);
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    await client.query("BEGIN");
    await setCurrentUserOnConnection(client, me);

    const selectedAliquots = Array.from(
      new Set(
        (biospecimens as Array<{ aliquots?: Array<string | number> }>)
          .flatMap((specimen) => specimen.aliquots ?? [])
          .map((aliquot) => String(aliquot).trim())
          .filter(Boolean)
      )
    );

    if (selectedAliquots.length > 0) {
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
        [selectedAliquots]
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
          message: `Cannot create shipment. Off-study participant aliquots detected: ${sample}`,
        };
      }
    }

    // Insert main shipment row
    const insertSql = `
      INSERT INTO ${quoteIdent(schema)}.shipments
        (${cols.map(quoteIdent).join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id
    `;
    const insertRes = await client.query<{ id: number }>(insertSql, vals);
    const newShipmentId = insertRes.rows[0].id;

    // Insert child shipment_items based on biospecimens[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const specimen of biospecimens as any[]) {
      for (const aliquotIdentifier of specimen.aliquots ?? []) {
        try {
          // Resolve aliquot,  internal ID + biospecimen_log_id
          const biospecimenQuery = await client.query(
            `
            SELECT id AS aliquot_id, biospecimen_log_id AS biospecimen_id
            FROM ${quoteIdent(schema)}.biospecimen_aliquots
            WHERE aliquot_identifier = $1 OR id::text = $1
            LIMIT 1
          `,
            [aliquotIdentifier]
          );

          if (biospecimenQuery.rows.length === 0) {
            console.warn(
              `No biospecimen found for aliquot: ${aliquotIdentifier}`
            );
            continue;
          }
          const { aliquot_id, biospecimen_id: resolvedBioId } =
            biospecimenQuery.rows[0];

          await client.query(
            `
              INSERT INTO ${quoteIdent(schema)}.shipment_items
                (shipment_id, biospecimen_id, biospecimen_aliquot_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (shipment_id, biospecimen_aliquot_id) DO NOTHING
            `,
            [newShipmentId, resolvedBioId, aliquot_id]
          );
        } catch (err: unknown) {
          if (!(err instanceof Error && (err as PgError).code === "23505")) {
            throw err;
          }
        }
      }
    }

    await client.query("COMMIT");
    return { success: true, id: newShipmentId };
  } catch (err: unknown) {
    await client.query("ROLLBACK");

    // Handle duplicate reference separately with user-friendly msg
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
        operation: "Insert:Shipment",
        userId: me,
        resource: `${schema}.shipments`,
        metadata: { payload },
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
