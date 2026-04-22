"use server";

import { insertFeedback } from "@/lib/feedback/sqlite-queries";
import { notifyFeedbackSubmitted } from "@/lib/feedback-notifications";
import { logError } from "@/lib/error-logger";

export async function insertTabledata(
  _schema: string,
  tableName: string,
  data: Record<string, unknown>
): Promise<
  | { success: true; rowCount: number; insertedId?: number | string }
  | { success: false; message: string }
> {
  if (tableName !== "feedbacks") {
    return { success: false, message: `Table "${tableName}" is not supported.` };
  }

  try {
    const { insertedId } = insertFeedback(data as Parameters<typeof insertFeedback>[0]);

    if (!data.draft) {
      const submittedByEmail =
        typeof data.email === "string" && data.email.trim()
          ? data.email.trim()
          : "unknown";
      const page = typeof data.page === "string" ? data.page : null;

      notifyFeedbackSubmitted({ feedbackId: insertedId, submittedByEmail, page }).catch(
        (err) =>
          logError(err, { operation: "NotifyFeedbackSubmitted", metadata: { feedbackId: insertedId } }, "error")
      );
    }

    return { success: true, rowCount: 1, insertedId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to insert feedback.";
    logError(err, { operation: `Insert:${tableName}` }, "error");
    return { success: false, message };
  }
}

