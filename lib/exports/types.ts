/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ExportRange {
  from: string;
  to: string;
}

export interface ExportContext {
  tableName?: string;
  schema: string;
  totalRows: number;
  initialRowData: any[];
  filteredRows: any[];
  augmentedColumnDef: any[];
  columnFilters: any[];
  softDeleteFilter: "All" | "Active" | "Draft" | "Trashed";
  dateFilter: {
    field: "created_at" | "updated_at";
    from: string;
    to: string;
  };
  exportRange?: ExportRange;
  isAuditLogTable: boolean;
  pathname?: string;
}
