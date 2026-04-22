import { ExportContext } from "./types";
import { fetchExportData } from "./fetch-export-data";
import { hydrateAuditLogData } from "./hydrate-audit";
import { buildRowValues } from "./row-transform";
import {
  buildClinicalSiteBreakdown,
  logClientActivity,
} from "@/lib/activity/client-activity-log";

export async function exportToExcel(ctx: ExportContext) {
  const XLSX = await import("xlsx");

  let data = await fetchExportData(ctx);
  data = await hydrateAuditLogData(data, ctx.isAuditLogTable);

  const headers = ctx.augmentedColumnDef.map((c) => c.header);
  const keys = ctx.augmentedColumnDef.map((c) => c.accessorKey);

  const sheetData = [
    headers,
    ...data.map((row) => buildRowValues(row, keys, ctx.pathname)),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");

  XLSX.writeFile(
    wb,
    `imdhub_export_${new Date().toISOString()}.xlsx`
  );

  void logClientActivity({
    eventType: "EXPORT_EXCEL",
    schemaName: ctx.schema,
    tableName: ctx.tableName,
    pagePath: ctx.pathname,
    fileType: "xlsx",
    rowCount: data.length,
    clinicalSiteBreakdown: buildClinicalSiteBreakdown(data),
    metadata: {
      softDeleteFilter: ctx.softDeleteFilter,
      hasColumnFilters: ctx.columnFilters.length > 0,
      dateFilter: ctx.dateFilter,
      exportRange: ctx.exportRange ?? null,
    },
  });
}
