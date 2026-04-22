"use server";

import { pgPool } from "@/lib/db";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";

/**
 * This function checks if the visit date is after the participant's birth date.
 * If the visit date is earlier, it returns an error message.
 * If the participant is not found, it returns an error message.
 * @param participantId - The ID of the participant.
 * @param dateOfVisit - The date of visit to validate.
 * @returns A promise that resolves to an object indicating success or failure.
 *         If successful, it returns { success: true }.
 *
 */

const monthNameToIndex: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

export async function validateDateOfVisit(
  participantId: number,
  dateOfVisit: string
): Promise<{ success: true } | { success: false; message: string }> {
  const client = await pgPool.connect();

  try {
    const result = await client.query<{
      year_of_birth: number;
      month_of_birth: string;
    }>(
      `SELECT year_of_birth, month_of_birth
       FROM imdhub_core.participant_registrations
       WHERE id = $1
       LIMIT 1`,
      [participantId]
    );

    if (result.rows.length === 0) {
      return { success: false, message: "Participant not found." };
    }

    const { year_of_birth, month_of_birth } = result.rows[0];

    const monthIndex = monthNameToIndex[month_of_birth];

    if (monthIndex === undefined) {
      return {
        success: false,
        message: `Invalid month name: ${month_of_birth}`,
      };
    }

    const birthDate = new Date(year_of_birth, monthIndex, 1);
    const visitDate = new Date(dateOfVisit);

    if (visitDate < birthDate) {
      return {
        success: false,
        message:
          "Date of visit cannot be earlier than participants date of birth.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: "Validate:DateOfVisit",
        userId: me,
        resource: "imdhub_core.participant_registrations",
        metadata: { participantId, dateOfVisit },
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
