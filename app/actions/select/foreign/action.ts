"use server";

import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";

import {
  getOrganisations,
  getStorageTemperatures,
  getParticipantIdentifiers,
  getParticipantRegistrations,
  getParticipantVisits,
  getAvailableAliquots,
  getIembaseDiagnoses,
  getGenericLookup
} from "@/lib/queries/foreign/lookup";

import {
  getFeedbackTypes,
  getFeedbackStatuses,
  getOrganisations as getFeedbackOrganisations,
} from "@/lib/feedback/sqlite-queries";

export async function getForeignTableData(
  schema: string,
  tableName: string,
  groups: string[] = [],
  filters: Record<string, string> = {},
): Promise<{ success: true; data: unknown[] } | { success: false; message: string }> {
  try {
    let data: unknown[];

    switch (tableName) {
      // ── SQLite-backed feedback reference tables ────────────────────────────
      case "organisations":
        data = getFeedbackOrganisations(filters);
        break;

      case "feedback_types":
        data = getFeedbackTypes();
        break;

      case "feedback_status":
        data = getFeedbackStatuses();
        break;

      // ── PostgreSQL-backed tables ───────────────────────────────────────────
      case "storage_temperatures":
        data = await getStorageTemperatures(schema);
        break;

      case "participant_identifiers":
        data = await getParticipantIdentifiers(schema, filters, groups);
        break;

      case "participant_registrations":
        data = await getParticipantRegistrations(schema, groups);
        break;

      case "participant_visits":
        data = await getParticipantVisits(schema, groups);
        break;

      case "v_available_aliquots":
        data = await getAvailableAliquots(groups);
        break;

      case "iembase_diagnoses":
        data = await getIembaseDiagnoses(schema);
        break;

      default:
        data = await getGenericLookup(schema, tableName);
        break;

    }

    return { success: true, data };
  } catch (err: unknown) {
    const [user_email] = await getUserEmailFromSession();
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `ForeignSelect:${tableName}`,
        userId: user_email || "imdhub-system",
        resource: `${schema}.${tableName}`,
        metadata: { filters, groups },
      },
      severity
    );

    return {
      success: false,
      message: getUserFriendlyMessage(err),
    };
  }
}
