"use server";

import { pgPool } from "@/lib/db";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { logError } from "@/lib/error-logger";

export type DownloadActivityEventType =
  | "EXPORT_CSV"
  | "EXPORT_EXCEL"
  | "COPY_ROW"
  | "COPY_LINK"
  | "DOWNLOAD_SHIPPING_TEMPLATE"
  | "DOWNLOAD_UNDIAGNOSED_SAMPLE_TEMPLATE";

export type DownloadActivityInput = {
  eventType: DownloadActivityEventType;
  schemaName?: string | null;
  tableName?: string | null;
  pagePath?: string | null;
  fileType?: string | null;
  rowCount?: number | null;
  clinicalSiteBreakdown?: Record<string, number> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logDownloadActivity({
  eventType,
  schemaName,
  tableName,
  pagePath,
  fileType,
  rowCount,
  clinicalSiteBreakdown,
  metadata,
  ipAddress,
  userAgent,
}: DownloadActivityInput): Promise<{ success: boolean; message?: string }> {
  const client = await pgPool.connect();
  const [userEmail] = await getUserEmailFromSession();
  const userId = userEmail || "unknown@imdhub-system";

  try {
    await client.query(
      `
        INSERT INTO imdhub_logs.download_activity_logs
          (
            user_id,
            event_type,
            schema_name,
            table_name,
            page_path,
            file_type,
            row_count,
            clinical_site_breakdown,
            metadata,
            ip_address,
            user_agent
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::inet, $11)
      `,
      [
        userId,
        eventType,
        schemaName ?? null,
        tableName ?? null,
        pagePath ?? null,
        fileType ?? null,
        typeof rowCount === "number" ? rowCount : 0,
        JSON.stringify(clinicalSiteBreakdown ?? {}),
        JSON.stringify(metadata ?? {}),
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );

    return { success: true };
  } catch (error) {
    logError(
      error,
      {
        operation: "Insert:download_activity_logs",
        userId,
        resource: "imdhub_logs.download_activity_logs",
        metadata: {
          eventType,
          schemaName,
          tableName,
          pagePath,
        },
      },
      "warning",
    );
    return { success: false, message: "Unable to write download activity log." };
  } finally {
    client.release();
  }
}
