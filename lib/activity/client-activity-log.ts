/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS } from "@/lib/urls";

export type ActivityEventType =
  | "EXPORT_CSV"
  | "EXPORT_EXCEL"
  | "COPY_ROW"
  | "COPY_LINK"
  | "DOWNLOAD_SHIPPING_TEMPLATE"
  | "DOWNLOAD_UNDIAGNOSED_SAMPLE_TEMPLATE";

type ActivityPayload = {
  eventType: ActivityEventType;
  schemaName?: string;
  tableName?: string;
  pagePath?: string;
  fileType?: string;
  rowCount?: number;
  clinicalSiteBreakdown?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export function buildClinicalSiteBreakdown(rows: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const site =
      row?.clinical_site_name ??
      row?.clinical_site ??
      row?.site_name ??
      row?.organisation_name ??
      "Unknown";
    const key = String(site).trim() || "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function logClientActivity(payload: ActivityPayload): Promise<void> {
  try {
    await secureFetch(API_ENDPOINTS.DOWNLOAD_ACTIVITY, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Activity log failed:", error);
  }
}
