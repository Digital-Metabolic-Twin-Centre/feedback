/* eslint-disable @typescript-eslint/no-explicit-any */

import { secureFetch } from "@/hooks/secure-fetch";
import { toast } from "sonner";
import { ExportContext } from "./types";

export async function fetchExportData(ctx: ExportContext): Promise<any[]> {
  const {
    tableName,
    schema,
    totalRows,
    initialRowData,
    filteredRows,
    columnFilters,
    softDeleteFilter,
    dateFilter,
    exportRange,
    isAuditLogTable,
  } = ctx;

  const hasColumnFilters = columnFilters?.length > 0;
  let data: any[] = [];

  // audit id range
  if (isAuditLogTable && exportRange?.from && exportRange?.to) {
    const fromId = Number(exportRange.from);
    const toId = Number(exportRange.to);

    if (!fromId || !toId || fromId > toId) {
      toast.error("Invalid ID range");
      return [];
    }

    if (toId - fromId + 1 > 2000) {
      toast.error("Export range cannot exceed 2000 records");
      return [];
    }

    const res = await secureFetch(
      `/api/select?table=${encodeURIComponent(
        tableName!
      )}&schema=${schema}&page=1&pageSize=${totalRows || 10000}`
    );
    const json = await res.json();
    data = json.data.filter(
      (r: any) => r.id >= fromId && r.id <= toId
    );
  }

  // column filters active
  else if (hasColumnFilters) {
    data = filteredRows;
  }

  // fetch all from API
  else if (tableName && totalRows > initialRowData.length) {
    const limit = isAuditLogTable ? Math.min(totalRows, 1500) : totalRows;

    if (isAuditLogTable && totalRows > 1500) {
      toast.warning(
        `Export limited to 1500 of ${totalRows}. Use ID range for full export.`
      );
    }

    const res = await secureFetch(
      `/api/select?table=${tableName}&schema=${schema}&page=1&pageSize=${limit}`
    );
    const json = await res.json();
    data = json.data;
  }

  // FALLBACK
  else {
    data = filteredRows.length ? filteredRows : initialRowData;
  }

  // soft delete filter
  if (softDeleteFilter !== "All") {
    data = data.filter((row) => {
      const soft = row.soft_delete === true || row.soft_delete === "true";
      const draft = row.draft === true || row.draft === "true";

      if (softDeleteFilter === "Active") return !soft && !draft;
      if (softDeleteFilter === "Draft") return draft;
      if (softDeleteFilter === "Trashed") return soft;
      return true;
    });
  }

  // date filter
  if (dateFilter.from || dateFilter.to) {
    const from = dateFilter.from ? new Date(dateFilter.from) : null;
    const to = dateFilter.to ? new Date(dateFilter.to) : null;
    if (to) to.setHours(23, 59, 59, 999);

    data = data.filter((row) => {
      const raw = row[dateFilter.field];
      if (!raw) return false;
      const d = new Date(raw);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  return data;
}
