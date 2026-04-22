"use server";

import { updateFeedback } from "@/lib/feedback/sqlite-queries";
import { logError } from "@/lib/error-logger";

export async function updateTableData(
  _schema: string,
  tableName: string,
  updates: Record<string, unknown>,
  where: Record<string, unknown>
): Promise<{ success: true; rowCount: number } | { success: false; message: string }> {
  if (tableName !== "feedbacks") {
    return { success: false, message: `Table "${tableName}" is not supported.` };
  }

  const id = Number(where?.id);
  if (!id || !Number.isFinite(id)) {
    return { success: false, message: "Invalid update request: where.id is required." };
  }

  try {
    const result = updateFeedback(id, updates);

    if ("error" in result) {
      return { success: false, message: result.error };
    }

    return { success: true, rowCount: result.rowCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update feedback.";
    logError(err, { operation: `Update:${tableName}`, metadata: { id } }, "error");
    return { success: false, message };
  }
}
