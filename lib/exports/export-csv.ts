import { ExportContext } from "./types";
import { fetchExportData } from "./fetch-export-data";
import { hydrateAuditLogData } from "./hydrate-audit";
import { buildRowValues } from "./row-transform";
import {
  buildClinicalSiteBreakdown,
  logClientActivity,
} from "@/lib/activity/client-activity-log";

export async function exportToCSV(ctx: ExportContext) {
  let data = await fetchExportData(ctx);
  data = await hydrateAuditLogData(data, ctx.isAuditLogTable);

  const headers = ctx.augmentedColumnDef.map((c) => c.header);
  const keys = ctx.augmentedColumnDef.map((c) => c.accessorKey);

  const rows = [
    headers.join(","),
    ...data.map((row) =>
      buildRowValues(row, keys, ctx.pathname, true).join(",")
    ),
  ];

  const blob = new Blob([rows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `imdhub_export_${new Date().toISOString()}.csv`;
  a.click();

  void logClientActivity({
    eventType: "EXPORT_CSV",
    schemaName: ctx.schema,
    tableName: ctx.tableName,
    pagePath: ctx.pathname,
    fileType: "csv",
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
