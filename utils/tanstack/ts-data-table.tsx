/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo, useEffect } from "react";
// TanStack Table imports
import {
  ColumnDef,
  SortingState,
  ExpandedState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { exportToCSV, exportToExcel } from "@/lib/exports";
import { hydrateAuditRowsForDisplay } from "@/utils/audit/hydrateAuditRowsForDisplay";
import FeedbackDialog from "@/utils/tanstack/ts-feedback";

// Using Shadcn UI components
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/hub/ConfirmDialog";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { formatDateTime } from "@/utils/components/format-date";
import { usePathname } from "next/navigation";

// Icons
import { FiEdit3, FiRefreshCw } from "react-icons/fi";
import { GoTrash } from "react-icons/go";
import { ImCopy } from "react-icons/im";
import { FaArrowUpWideShort, FaArrowDownWideShort } from "react-icons/fa6";
import { useSharedFormState } from "@/hooks/form-state-provider";
import { SHIPMENT_STATUS } from "@/lib/constants";
import { SITE_PERMISSIONS, ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";

import { toast } from "sonner";

import DatePickerWithDefaults from "@/components/hub/DatePickerWithDefaultLocale";
import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS, ECRFS_LINKS } from "@/lib/urls";
import { SITE_PATHS } from "@/lib/urls";
import { FEEDBACK_STATUSES } from "@/lib/constants";

function countCodes(val: unknown): number {
  if (!val || typeof val !== "string") return 0;
  return val.split("|").filter(Boolean).length;
}
import {
  buildClinicalSiteBreakdown,
  logClientActivity,
} from "@/lib/activity/client-activity-log";

// Handle marking shipment as shipped/received using api call
const handleShipmentShippedOrReceived = async (
  rowData: any,
  action: string,
) => {
  try {
    const res = await secureFetch(API_ENDPOINTS.UPDATE, {
      method: "POST",
      body: JSON.stringify({
        schema: "imdhub_core",
        tableName: action,
        updates: {},
        where: { id: rowData.id },
      }),
    });

    const json = await res.json();

    if (!json.success) {
      toast.error("Failed to update status");
      return;
    }

    toast.success("Shipment marked as shipped");

    // Hard reload the table data (your current architecture requires it)
    window.location.reload();
  } catch (err) {
    console.error("Shipment update error:", err);
    toast.error("Error updating shipment");
  }
};

interface TableProps {
  initialRowData: any[];
  initialColumnDef: any[];
  detailColumnDef: string[];
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  onEdit: (row: any) => void;
  onTrash: (row: any) => void;
  onRestore: (row: any) => void;
  onDelete: (row: any) => void;
  tableName?: string;
  schema?: string;
  exportRange?: { from: string; to: string };
  setExportRange?: React.Dispatch<
    React.SetStateAction<{ from: string; to: string }>
  >;
  refetchTable?: () => void;
  meta?: {
    openBoxViewer?: (items: any[]) => void;
  };
}

export const TanTable: React.FC<TableProps> = ({
  initialRowData,
  initialColumnDef,
  detailColumnDef,
  pagination,
  setPagination,
  onEdit,
  onTrash,
  onRestore,
  onDelete,
  tableName,
  schema = "imdhub_core",
  exportRange,
  setExportRange,
  refetchTable,
  meta,
}) => {
  const { data: session } = useSession();
  const roles = (session as any)?.roles || [];
  const groups: string[] = (session as any)?.groups || [];

  const pathname = usePathname(); // Use usePathname instead
  const isParticipantIdentifierTable = pathname?.includes(
    SITE_PATHS.PARTICIPANT_IDENTIFIERS,
  );
  const isAuditLogTable =
    pathname?.includes(SITE_PATHS.ADMIN_AUDIT_LOGS) ||
    pathname?.includes(SITE_PATHS.ADMIN_ACCESS_LOGS) ||
    pathname?.includes(SITE_PATHS.ADMIN_ACCESS_NOTIFICATIONS) ||
    pathname?.includes(SITE_PATHS.ADMIN_DOWNLOAD_ACTIVITY_LOGS);
  const isShipmentsReceivingTable = pathname?.includes(
    SITE_PATHS.SHIPMENT_RECEIVING_PRY,
  );
  const isStudySiteStatusTable = pathname?.includes(
    SITE_PATHS.STUDY_SITE_STATUS,
  );

  // Use passed-in detail column definitions.
  const detailColumnsAccessors = detailColumnDef;

  // Ensure created_at / updated_at columns exist (if present in the data)
  const augmentedColumnDef = useMemo(() => {
    const exists = (key: string) =>
      Array.isArray(initialRowData) &&
      initialRowData.some((r) => r && r[key] != null && r[key] !== "");

    const mkDateCol = (key: string, label: string) => ({
      accessorKey: key,
      header: label,
      // Format as date/time in cells
      cell: ({ getValue }: { getValue: () => any }) => {
        const v = getValue();
        return v ? formatDateTime(v) : "";
      },
      enableSorting: true,
      enableHiding: true,
    });

    const cols = [...initialColumnDef];

    if (
      !cols.some((c) => c.accessorKey === "created_at") &&
      exists("created_at")
    ) {
      cols.push(mkDateCol("created_at", "Created Date"));
    }
    if (
      !cols.some((c) => c.accessorKey === "updated_at") &&
      exists("updated_at")
    ) {
      cols.push(mkDateCol("updated_at", "Updated Date"));
    }

    return cols;
  }, [initialColumnDef, initialRowData]);

  // Separate main vs. detail columns.
  const mainColumnsDef = useMemo(
    () =>
      augmentedColumnDef.filter(
        (col) => !detailColumnsAccessors.includes(col.accessorKey),
      ),
    [augmentedColumnDef, detailColumnsAccessors],
  );

  const detailColumns = useMemo(
    () =>
      augmentedColumnDef.filter((col) =>
        detailColumnsAccessors.includes(col.accessorKey),
      ),
    [augmentedColumnDef, detailColumnsAccessors],
  );

  // Define the expander column for row expansion.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expanderColumn: ColumnDef<any, any> = {
    id: "expander",
    header: () => null,
    cell: ({ row }) =>
      !isAuditLogTable &&
      !isSystemSettingsTable && (
        <Button
          variant="outline"
          size="sm"
          className="bg-gray-400 hover:bg-gray-300 font-bold"
          onClick={row.getToggleExpandedHandler()}
        >
          {row.getIsExpanded() ? "—" : "+"}
        </Button>
      ),
    enableSorting: false,
    enableHiding: false,
  };

  // Filter records based on Trashed or Active records
  const {
    softDeleteFilter,
    setSoftDeleteFilter,
    statusFilter,
    setStatusFilter,
  } = useSharedFormState();
  const [dateFilter, setDateFilter] = useState<{
    field: "created_at" | "updated_at";
    from: string;
    to: string;
  }>({ field: "created_at", from: "", to: "" });
  const [isToolbarOpen, setIsToolbarOpen] = useState<boolean>(() => {
    // Load from sessionStorage on first render
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("toolbarOpen");
      return saved === "true";
    }
    return true; // fallback if no storage
  });

  // Persist whenever it changes
  useEffect(() => {
    sessionStorage.setItem("toolbarOpen", String(isToolbarOpen));
  }, [isToolbarOpen]);

  // Ensure only active records are showing on the shipments receiving table by default
  useEffect(() => {
    if (isShipmentsReceivingTable) {
      setSoftDeleteFilter("Active");
    }
  }, [isShipmentsReceivingTable, setSoftDeleteFilter]);

  // Define the Edit column (separate from dropdown)

  const isShipmentTrackingTable = pathname?.includes(
    SITE_PATHS.SHIPMENT_TRACKING,
  );
  const isSampleWithdrawalTable = pathname?.includes(
    SITE_PATHS.SAMPLE_WITHDRAWAL,
  );
  const isAnalysisScheduleTable = pathname?.includes(
    SITE_PATHS.ANALYSIS_SCHEDULE,
  );
  const isLabWorkspaceTable =
    isShipmentsReceivingTable || isSampleWithdrawalTable || isAnalysisScheduleTable;
  const isEcrfTable = ECRFS_LINKS.some((p) => pathname?.includes(p));
  const isSystemSettingsTable = pathname?.includes(
    SITE_PATHS.ADMIN_SYSTEM_SETTINGS,
  );
  const isSuspectedImdCasesTable = pathname?.includes(
    SITE_PATHS.SUSPECTED_IMD_CASES,
  );
  const isRecon4imdContactPage = pathname?.includes(SITE_PATHS.CONTACTS);

  // Controlling the dialog feedback for genomics group submission
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const canSubmitGenomicsFeedback =
    isSuspectedImdCasesTable &&
    roles.includes(SITE_PERMISSIONS.CAN_SUBMIT_GENOMICS_FEEDBACK);

  // Controlling the confirm dialog for marking shipments as shipped/received
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<"shipped" | "received" | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const editColumn: ColumnDef<any, any> = {
    id: "edit",
    enableHiding: false,
    cell: ({ row }) => {
      const rowData = row.original;

      const isRowOwnedByLoggedInUser = rowData.can_edit === true;

      const isShipmentReceivingNoChange =
        isShipmentsReceivingTable &&
        (
          rowData.status_name.toLowerCase() === SHIPMENT_STATUS.SHIPMENT_RECEIVED.toLowerCase() ||
          rowData.aliquot_received_codes === null
        );

      const isShipmentTrackingNoChange =
        isShipmentTrackingTable &&
        rowData.status_name.toLowerCase() !== SHIPMENT_STATUS.SHIPMENT_PENDING.toLowerCase();

      const isFeedbackPage = pathname?.includes(SITE_PATHS.FEEDBACKS);
      const isFeedbackClosed =
        isFeedbackPage &&
        rowData.feedback_status_name === FEEDBACK_STATUSES[3]; // "Closed"
      const isAdminGroup = isFeedbackPage &&
        groups.some((g: string) =>
          g.replace(/^\//, "").trim().toLowerCase().replace(/\s+/g, "_") ===
          ADMIN_GROUP_VIEW_PERMISSIONS.toLowerCase().replace(/\s+/g, "_")
        );
      const canViewFeedbackThread = isFeedbackPage;
      const hasUpdatePermission = isSuspectedImdCasesTable
        ? roles.includes(SITE_PERMISSIONS.CAN_UPDATE_SUSPECTED_CASES)
        : isEcrfTable
          ? roles.includes(SITE_PERMISSIONS.CAN_UPDATE_ECRF)
          : isLabWorkspaceTable
            ? roles.includes(SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB) ||
              roles.includes(SITE_PERMISSIONS.CAN_UPDATE_ECRF) ||
              roles.includes(SITE_PERMISSIONS.CAN_UPDATE)
          : roles.includes(SITE_PERMISSIONS.CAN_UPDATE);
      const meetsSuspectedCasesOwnershipRequirement =
        !isSuspectedImdCasesTable || isRowOwnedByLoggedInUser;

      const canEdit =
        !isParticipantIdentifierTable &&
        !isAuditLogTable &&
        (!isShipmentsReceivingTable || !isShipmentReceivingNoChange) &&
        (!isShipmentTrackingTable || !isShipmentTrackingNoChange) &&
        (isFeedbackPage
          ? isAdminGroup && !isFeedbackClosed
          : hasUpdatePermission &&
          meetsSuspectedCasesOwnershipRequirement &&
          (isRecon4imdContactPage
            ? roles.includes(SITE_PERMISSIONS.CAN_CONTACTS_ADMIN) ||
            isRowOwnedByLoggedInUser
            : true));

      const showShipButton =
        isShipmentTrackingTable &&
        rowData.status_name === SHIPMENT_STATUS.SHIPMENT_PENDING;

      if (!canEdit && !canViewFeedbackThread && !showShipButton && !canSubmitGenomicsFeedback)
        return null;

      return (
        <div className="flex flex-col gap-1">
          {(isFeedbackPage ? canViewFeedbackThread : canEdit) && !isAnalysisScheduleTable && (
            <Button
              variant="ghost"
              size="sm"
              className="border border-blue-600 hover:bg-blue-600 hover:text-white rounded-lg px-2 py-1"
              onClick={() => onEdit(rowData)}
            >
              <FiEdit3 className="h-4 w-4 mr-1" /> {isFeedbackPage ? "View Thread" : "Edit"}
            </Button>
          )}

          {canSubmitGenomicsFeedback && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRow(rowData);
                setGroupDialogOpen(true);
              }}
            >
              Evaluation Feedback
            </Button>
          )}
        </div>
      );
    },
  };

  // Define the Actions column.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actionColumn: ColumnDef<any, any> = {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const isTrashed =
        row.original["soft_delete"] === true ||
        row.original["soft_delete"] === "true"; // keep track of trashed
      const isRowOwnedByLoggedInUser = row.original.can_edit === true;

      const canTrash =
        (
          isSuspectedImdCasesTable
            ? roles.includes(SITE_PERMISSIONS.CAN_TRASH_SUSPECTED_CASES)
            : isEcrfTable
              ? roles.includes(SITE_PERMISSIONS.CAN_TRASH_ECRF)
              : roles.includes(SITE_PERMISSIONS.CAN_TRASH)
        ) &&
        (
          isShipmentTrackingTable
            ? row.original.status_name === SHIPMENT_STATUS.SHIPMENT_PENDING
            : true
        ) &&
        (
          isSuspectedImdCasesTable
            ? isRowOwnedByLoggedInUser
            : true
        );

      const canRestore =
        (isSuspectedImdCasesTable
          ? roles.includes(SITE_PERMISSIONS.CAN_RESTORE_SUSPECTED_CASES)
          : isEcrfTable
            ? roles.includes(SITE_PERMISSIONS.CAN_RESTORE_ECRF)
            : roles.includes(SITE_PERMISSIONS.CAN_RESTORE)) &&
        (isSuspectedImdCasesTable
          ? isRowOwnedByLoggedInUser
          : true);

      const canDelete =
        (isSuspectedImdCasesTable
          ? roles.includes(SITE_PERMISSIONS.CAN_DELETE_SUSPECTED_CASES)
          : isEcrfTable
            ? roles.includes(SITE_PERMISSIONS.CAN_DELETE_ECRF)
            : roles.includes(
              isParticipantIdentifierTable
                ? SITE_PERMISSIONS.CAN_DELETE_PID
                : SITE_PERMISSIONS.CAN_DELETE,
            )) &&
        (isSuspectedImdCasesTable
          ? isRowOwnedByLoggedInUser
          : true);

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          {!isParticipantIdentifierTable &&
            !isAuditLogTable &&
            !isShipmentsReceivingTable &&
            (isSuspectedImdCasesTable ? isRowOwnedByLoggedInUser : true) &&
            (isRecon4imdContactPage
              ? roles.includes(SITE_PERMISSIONS.CAN_CONTACTS_ADMIN)
              : true) && (
              <DropdownMenuContent align="end">
                <DropdownMenuLabel></DropdownMenuLabel>
                {roles.includes(SITE_PERMISSIONS.CAN_COPY_ROW) &&
                  !isParticipantIdentifierTable && !isShipmentTrackingTable && (
                    <DropdownMenuItem
                      className="hover:cursor-pointer"
                      onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, soft_delete, search_vector, ...cleaned } =
                          row.original;
                        navigator.clipboard.writeText(
                          JSON.stringify(cleaned, null, 2),
                        );
                        void logClientActivity({
                          eventType: "COPY_ROW",
                          schemaName: schema,
                          tableName,
                          pagePath: pathname,
                          fileType: "json",
                          rowCount: 1,
                          clinicalSiteBreakdown: buildClinicalSiteBreakdown([
                            row.original,
                          ]),
                          metadata: {
                            rowId: id,
                            participantId:
                              row.original?.participant_id ??
                              row.original?.participant_identifier ??
                              null,
                            participantCode:
                              row.original?.participant_id_code ?? null,
                          },
                        });
                      }}
                    >
                      <ImCopy /> Copy
                    </DropdownMenuItem>
                  )}{" "}
                {!isTrashed && canTrash && !isAnalysisScheduleTable && (
                  <DropdownMenuItem
                    className="hover:cursor-pointer"
                    onClick={() => onTrash(row.original)}
                  >
                    <GoTrash /> Trash
                  </DropdownMenuItem>
                )}
                {isTrashed && (
                  <>
                    {canRestore && (
                      <DropdownMenuItem
                        className="hover:cursor-pointer"
                        onClick={() => onRestore(row.original)}
                      >
                        <FiRefreshCw /> Restore
                      </DropdownMenuItem>
                    )}

                    {canDelete && (
                      <DropdownMenuItem
                        className="hover:cursor-pointer text-red-600 hover:text-red-500"
                        onClick={() => onDelete(row.original)}
                      >
                        <GoTrash /> Delete
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            )}
        </DropdownMenu>
      );
    },
  };

  // Combine expander, main columns, and actions column.
  const mainColumns: ColumnDef<any, any>[] = useMemo(() => {
    const dataCols = mainColumnsDef as ColumnDef<any, any>[];

    return [expanderColumn, editColumn, ...dataCols, actionColumn];
  }, [expanderColumn, editColumn, mainColumnsDef, actionColumn]);

  // Table states.
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const { totalRows } = useSharedFormState();
  const [allData, setAllData] = useState<any[]>([]);
  // const [loadingAllData, setLoadingAllData] = useState(false);
  const [allDataFetched, setAllDataFetched] = useState(false);

  const [templateFilter, setTemplateFilter] = useState({
    field: "created_at",
    from: "",
    to: "",
  });
  useEffect(() => {
    setTemplateFilter(dateFilter);
  }, [dateFilter]);

  // Reset allData when initialRowData changes to make sure table is in sync
  useEffect(() => {
    // Fresh data arrived from parent (edit / create / refetch)
    setAllData([]);
    setAllDataFetched(false);
  }, [initialRowData]);

  // Fetch all data when column filters are applied
  useEffect(() => {
    const hasColumnFilters = columnFilters && columnFilters.length > 0;

    // Only fetch if we have filters, haven't fetched yet, and data exists on server
    if (
      hasColumnFilters &&
      !allDataFetched &&
      tableName &&
      schema &&
      totalRows > initialRowData.length
    ) {
      const fetchAllData = async () => {
        // setLoadingAllData(true);
        try {
          const params = new URLSearchParams({
            table: tableName,
            schema: schema,
            page: "1",
            pageSize: String(totalRows),
          });

          if (softDeleteFilter === "Trashed") {
            params.set("soft_delete", "true");
          }

          if (softDeleteFilter === "Draft") {
            params.set("draft", "true");
          }

          if (softDeleteFilter === "Active") {
            params.set("soft_delete", "false");
            params.set("draft", "false");
          }

          //! All: send NOTHING

          const res = await secureFetch(`/api/select?${params.toString()}`);
          const json = await res.json();

          if (json.success && json.data) {
            let rows = json.data;

            if (isAuditLogTable) {
              rows = await hydrateAuditRowsForDisplay(rows);
            }

            setAllData(rows);
            setAllDataFetched(true);
          } else {
            setAllData([]);
          }
        } catch (error) {
          console.error("Fetch all data error:", error);
          setAllData([]);
        } finally {
          // setLoadingAllData(false);
        }
      };

      fetchAllData();
    } else if (!hasColumnFilters) {
      // Reset when no filters
      setAllData([]);
      setAllDataFetched(false);
      // setLoadingAllData(false);
    }
  }, [
    columnFilters,
    softDeleteFilter,
    allDataFetched,
    tableName,
    schema,
    totalRows,
    initialRowData.length,
    isAuditLogTable,
  ]);

  // filter data based on statusFilter and dateFilter
  const filteredData = useMemo(() => {
    // Use allData if column filters are active and we have fetched all data
    const hasColumnFilters = columnFilters && columnFilters.length > 0;
    let data =
      hasColumnFilters && allData.length > 0 ? allData : initialRowData;

    // Date filter (created_at / updated_at)
    if (dateFilter.from || dateFilter.to) {
      const fromDate = dateFilter.from ? new Date(dateFilter.from) : null;
      const toDate = dateFilter.to ? new Date(dateFilter.to) : null;

      // bump toDate to the END of the day (23:59:59.999)
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      data = data.filter((row) => {
        const raw = row[dateFilter.field];
        if (!raw) return false;

        const d = new Date(raw);
        if (isNaN(d.getTime())) return false;

        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    }

    return data;
  }, [initialRowData, dateFilter, columnFilters, allData]);

  const pageCount = Math.ceil(totalRows / pagination.pageSize);

  const hasColumnFilters = columnFilters && columnFilters.length > 0;

  // Initialize the table instance.
  const table = useReactTable({
    data: filteredData,
    columns: mainColumns,
    meta,
    state: {
      sorting,
      expanded,
      columnFilters,
      columnVisibility,
      pagination: hasColumnFilters
        ? { pageIndex: 0, pageSize: filteredData.length }
        : pagination,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    manualPagination: !hasColumnFilters,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    pageCount: hasColumnFilters ? 1 : pageCount,
  });

  // Setup virtualizer
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 50,
    overscan: 10,
    measureElement:
      typeof window !== "undefined" &&
        navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // Expand/Collapse All handlers.
  const handleExpandAll = () => {
    const allExpanded: ExpandedState = {};
    table.getRowModel().rows.forEach((row) => {
      allExpanded[row.id] = true;
    });
    setExpanded(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpanded({});
  };

  // Calculate the number of detail columns to determine grid layout.
  // const detailedColCount = detailColumns.length > 40 ? 15 : 5;

  // Page-size options.
  const pageSizeOptions = [10, 20, 50, 100];

  return (
    <div className="w-full">
      {/* Toolbar */}
      <Collapsible
        className="w-full border rounded-md bg-white shadow-sm"
        open={isToolbarOpen}
        onOpenChange={setIsToolbarOpen}
      >
        <CollapsibleTrigger asChild>
          <div className="group flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-md cursor-pointer hover:bg-gray-100">
            {/* Left: title */}
            <h2 className="text-sm font-semibold text-gray-700">Toolbar</h2>

            {/* Center: legend (only if All) */}
            {softDeleteFilter === "All" && !isParticipantIdentifierTable && (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="w-3 h-3 bg-green-100 border border-green-400 rounded-sm" />
                  Active
                </span>
                {!isSystemSettingsTable && (
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    <span className="w-3 h-3 bg-blue-100 border border-blue-400 rounded-sm" />
                    Draft
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="w-3 h-3 bg-red-100 border border-red-400 rounded-sm" />
                  Trashed
                </span>
              </div>
            )}
            {isParticipantIdentifierTable && (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="w-3 h-3 bg-green-100 border border-green-400 rounded-sm" />
                  Available
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="w-3 h-3 bg-blue-100 border border-blue-400 rounded-sm" />
                  Assigned
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="w-3 h-3 bg-red-100 border border-red-400 rounded-sm" />
                  Withdrawn
                </span>
              </div>
            )}

            {/* Right: Chevron */}
            <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>

        {/* Collapsible content */}
        <CollapsibleContent>
          <div className="flex flex-wrap items-center justify-between  px-4 py-3">
            {/* Left section */}
            <div className="flex flex-wrap items-center gap-3">
              {!isAuditLogTable && (
                <>
                  <Button variant="outline" size="sm" onClick={handleExpandAll}>
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCollapseAll}
                  >
                    Collapse All
                  </Button>
                </>
              )}

              {roles.includes(SITE_PERMISSIONS.CAN_EXPORT) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToCSV({
                        tableName,
                        schema,
                        totalRows,
                        initialRowData,
                        filteredRows: table
                          .getFilteredRowModel()
                          .rows.map((r) => r.original),
                        augmentedColumnDef,
                        columnFilters,
                        softDeleteFilter,
                        dateFilter,
                        exportRange,
                        isAuditLogTable,
                        pathname,
                      })
                    }
                  >
                    Export CSV
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportToExcel({
                        tableName,
                        schema,
                        totalRows,
                        initialRowData,
                        filteredRows: table
                          .getFilteredRowModel()
                          .rows.map((r) => r.original),
                        augmentedColumnDef,
                        columnFilters,
                        softDeleteFilter,
                        dateFilter,
                        exportRange,
                        isAuditLogTable,
                        pathname,
                      })
                    }
                  >
                    Export Excel
                  </Button>
                </>
              )}

              {/* Page-size selector */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="pageSize"
                  className="text-xs font-medium text-gray-600"
                >
                  Rows:
                </label>
                <select
                  id="pageSize"
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                >
                  {pageSizeOptions.map((ps) => (
                    <option key={ps} value={ps}>
                      {ps}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Right section (trash filter + columns toggle) */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Record filter */}
              {!isParticipantIdentifierTable &&
                !isShipmentsReceivingTable &&
                !isAuditLogTable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {softDeleteFilter} Records
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    {/* Dont show Trashed, Draft,Active option for participant identifier table */}

                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        value={softDeleteFilter}
                        onValueChange={(value: string) =>
                          setSoftDeleteFilter(
                            value as "All" | "Active" | "Trashed" | "Draft",
                          )
                        }
                      >
                        <DropdownMenuRadioItem value="All">
                          All
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Active">
                          Active
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Trashed">
                          Trashed
                        </DropdownMenuRadioItem>
                        {!isStudySiteStatusTable && !isSystemSettingsTable && (
                          <DropdownMenuRadioItem value="Draft">
                            Draft
                          </DropdownMenuRadioItem>
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

              {/* Column toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Columns <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value: any) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between  px-4 py-3">
            {/* Middle section (date filter) */}
            <div className="flex flex-wrap items-center gap-2 border-l-2">
              {!isAuditLogTable && !isAnalysisScheduleTable && (
                <>
                  <label className="text-xs font-medium text-gray-600">
                    Filter by:
                  </label>
                  <select
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    value={dateFilter.field}
                    onChange={(e) =>
                      setDateFilter({
                        ...dateFilter,
                        field: e.target.value as "created_at" | "updated_at",
                      })
                    }
                  >
                    <option value="created_at">Created Date</option>
                    <option value="updated_at">Updated Date</option>
                  </select>
                  <DatePickerWithDefaults
                    selected={
                      dateFilter.from ? new Date(dateFilter.from) : null
                    }
                    onChange={(date) => {
                      setDateFilter({
                        ...dateFilter,
                        from: date ? date.toLocaleDateString("en-CA") : "", // keep ISO (yyyy-mm-dd) internally
                      });
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/MM/yyyy"
                    maxDate={new Date()}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                  />

                  <span className="text-xs text-gray-500">to</span>
                  <DatePickerWithDefaults
                    selected={dateFilter.to ? new Date(dateFilter.to) : null}
                    onChange={(date) => {
                      setDateFilter({
                        ...dateFilter,
                        to: date ? date.toLocaleDateString("en-CA") : "", // keep ISO (yyyy-mm-dd) internally
                      });
                    }}
                    placeholderText="dd/MM/yyyy"
                    dateFormat="dd/MM/yyyy"
                    maxDate={new Date()}
                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setDateFilter({ ...dateFilter, from: "", to: "" })
                    }
                  >
                    Clear
                  </Button>
                </>
              )}

              {/* ID Range export for audit log tables */}
              {isAuditLogTable &&
                setExportRange &&
                exportRange &&
                roles.includes(SITE_PERMISSIONS.CAN_EXPORT) && (
                  <>
                    <div className="border-l-2 pl-3 ml-2">
                      <label className="text-xs font-medium text-gray-600">
                        Export ID Range (max 2000):
                      </label>
                    </div>
                    <Input
                      type="number"
                      placeholder="From ID"
                      value={exportRange.from}
                      onChange={(e) =>
                        setExportRange({ ...exportRange, from: e.target.value })
                      }
                      className="w-24 text-xs h-8"
                      min="1"
                    />
                    <span className="text-xs text-gray-500">to</span>
                    <Input
                      type="number"
                      placeholder="To ID"
                      value={exportRange.to}
                      onChange={(e) =>
                        setExportRange({ ...exportRange, to: e.target.value })
                      }
                      className="w-24 text-xs h-8"
                      min="1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setExportRange({ from: "", to: "" })}
                    >
                      Clear
                    </Button>
                  </>
                )}

              {roles.includes(SITE_PERMISSIONS.CAN_EXPORT) && (
                <>
                  {(pathname?.includes(SITE_PATHS.SHIPMENT_TRACKING) ||
                    pathname?.includes("/biospecimen/logs")) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!templateFilter.from || !templateFilter.to) {
                            toast.error(
                              "Please select a date range before downloading the template",
                            );
                            return;
                          }

                          const query = new URLSearchParams({
                            table: "shipping_template",
                            schema: "imdhub_core",
                            field: templateFilter.field,
                            from: templateFilter.from
                              ? new Date(templateFilter.from).toISOString()
                              : "",
                            to: templateFilter.to
                              ? new Date(templateFilter.to).toISOString()
                              : "",
                          });

                          setDownloadingTemplate(true);

                          // Fetch as JSON (not blob)
                          const res = await secureFetch(
                            `/api/select?${query.toString()}`,
                          );
                          const json = await res.json();

                          const rows = json.data ?? []; // fallback if undefined

                          if (!Array.isArray(rows) || rows.length === 0) {
                            toast.error(
                              "No shipment data found for this date range.",
                            );
                            setDownloadingTemplate(false);
                            return;
                          }

                          // Add extra column as the first field
                          const enrichedRows = rows.map((row) => ({
                            // shipping_batch: "", // removed shpment batch as we no long have multiple shipment templates
                            ...row,
                          }));

                          // Build Excel
                          const XLSX = await import("xlsx");
                          const worksheet =
                            XLSX.utils.json_to_sheet(enrichedRows);
                          const workbook = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(
                            workbook,
                            worksheet,
                            "Shipment Template",
                          );

                          // Save file
                          const date = new Date();
                          const formattedDate = date
                            .toISOString()
                            .replace(/[:.]/g, "-");
                          XLSX.writeFile(
                            workbook,
                            `shipping_template_${formattedDate}.xlsx`,
                          );

                          void logClientActivity({
                            eventType: "DOWNLOAD_SHIPPING_TEMPLATE",
                            schemaName: "imdhub_core",
                            tableName: "shipping_template",
                            pagePath: pathname,
                            fileType: "xlsx",
                            rowCount: rows.length,
                            clinicalSiteBreakdown:
                              buildClinicalSiteBreakdown(rows),
                            metadata: {
                              filterField: templateFilter.field,
                              from: templateFilter.from,
                              to: templateFilter.to,
                            },
                          });

                          setDownloadingTemplate(false);
                        }}
                        className={`text-xs ${downloadingTemplate
                          ? "cursor-not-allowed opacity-50 bg-gray-200"
                          : "bg-yellow-300 hover:bg-yellow-400"
                          }`}
                        disabled={downloadingTemplate}
                      >
                        {downloadingTemplate ? (
                          <>Generating...</>
                        ) : (
                          <>Generate Shipping Template</>
                        )}
                      </Button>
                    )}
                </>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Main Table */}
      <div
        ref={tableContainerRef}
        className="w-full overflow-auto rounded-md border relative"
        style={{
          maxHeight: "600px",
          overflowX: "auto",
          overflowY: "auto",
        }}
      >
        <Table className="w-full border-collapse min-w-full">
          <TableHeader className="sticky top-0 z-100  shadow-sm will-change-transform">
            {table.getHeaderGroups().map((headerGroup) => (
              <React.Fragment key={headerGroup.id}>
                <TableRow>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="border p-2 z-100  text-xs cursor-pointer align-top"
                      onClick={
                        header.column.getCanSort()
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="inline-flex items-cenAAter gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        {header.column.getIsSorted() === "asc" && (
                          <FaArrowUpWideShort />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <FaArrowDownWideShort />
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                {/* Filter inputs per column */}
                <TableRow>
                  {headerGroup.headers.map((header) =>
                    header.isPlaceholder ? (
                      <TableHead key={header.id} />
                    ) : (
                      <TableCell
                        key={header.id}
                        className="border p-2 bg-gray-50 text-xs"
                      >
                        {header.column.getCanFilter() && (
                          <>
                            {/* Special case: Participant Identifier + status column */}
                            {isParticipantIdentifierTable &&
                              header.column.id === "status" ? (
                              <select
                                className="text-sm border border-gray-300 rounded px-1 p-2 w-full bg-white"
                                value={
                                  (header.column.getFilterValue() as string) ??
                                  "All"
                                }
                                onChange={(e) => {
                                  const val = e.target.value as
                                    | "All"
                                    | "Assigned"
                                    | "Available"
                                    | "Withdrawn";

                                  setStatusFilter(val);

                                  header.column.setFilterValue(
                                    val === "All" ? undefined : val,
                                  );
                                }}
                              >
                                <option value="All">All</option>
                                <option value="Assigned">Assigned</option>
                                <option value="Available">Available</option>
                                <option value="Withdrawn">Withdrawn</option>
                              </select>
                            ) : (
                              // Default: text input filter
                              <Input
                                placeholder={`Search ${header.column.id}`}
                                className="text-xs"
                                value={
                                  (header.column.getFilterValue() as string) ??
                                  ""
                                }
                                onChange={(e) =>
                                  header.column.setFilterValue(e.target.value)
                                }
                              />
                            )}
                          </>
                        )}
                      </TableCell>
                    ),
                  )}
                </TableRow>
              </React.Fragment>
            ))}
          </TableHeader>

          <TableBody>
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={table.getAllColumns().length}
                  style={{
                    height: `${rowVirtualizer.getVirtualItems()[0].start}px`,
                  }}
                />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-index={virtualRow.index}
                    ref={(node) => {
                      if (node) {
                        queueMicrotask(() =>
                          rowVirtualizer.measureElement(node),
                        );
                      }
                    }}
                    data-state={row.getIsSelected() && "selected"}
                    className={
                      isParticipantIdentifierTable
                        ? statusFilter === "All"
                          ? row.original.status === "Available"
                            ? "bg-green-100"
                            : row.original.status === "Assigned"
                              ? "bg-blue-100"
                              : row.original.status === "Withdrawn"
                                ? "bg-red-100"
                                : ""
                          : ""
                        : softDeleteFilter === "All"
                          ? row.original.soft_delete === true ||
                            row.original.soft_delete === "true"
                            ? "bg-red-100"
                            : row.original.draft === true ||
                              row.original.draft === "true"
                              ? "bg-blue-100"
                              : "bg-green-100"
                          : ""
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="border p-2 text-xs">
                        {(() => {
                          const raw = cell.getValue();

                          // If value is a base64 image (signature), render it
                          if (
                            typeof raw === "string" &&
                            raw.startsWith("data:image/png;base64")
                          ) {
                            return (
                              <Image
                                src={raw}
                                width={50}
                                height={50}
                                alt="Signature"
                                className="max-h-12 max-w-[150px] border rounded"
                              />
                            );
                          }

                          // Fallback to default renderer
                          return flexRender(
                            cell.column.columnDef.cell ??
                            (({ getValue }) => getValue()),
                            cell.getContext(),
                          );
                        })()}
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* Detail (collapsible) rows rendered as individual full-width rows */}
                  {row.getIsExpanded() &&
                    (() => {
                      const visibleDetailCols = detailColumns.filter((col) => {
                        const val = row.original[col.accessorKey];
                        return val !== null && val !== undefined && val !== "";
                      });

                      const detailedColCount =
                        visibleDetailCols.length > 40 ? 15 : 5;

                      return (
                        <TableRow className="bg-gray-50">
                          <TableCell
                            colSpan={row.getVisibleCells().length}
                            className="p-4 w-full"
                          >
                            <div
                              className="grid gap-2"
                              style={{
                                display: "grid",
                                gridAutoFlow: "column",
                                gridTemplateRows: `repeat(${detailedColCount}, minmax(0, 1fr))`,
                              }}
                            >
                              {detailColumns.map((detailCol) => {
                                let rawValue =
                                  row.original[detailCol.accessorKey];

                                // For the shipment conputed columns
                                if (rawValue === undefined) {
                                  if (
                                    detailCol.accessorKey ===
                                    "aliquot_sent_count"
                                  ) {
                                    rawValue = countCodes(
                                      row.original.aliquot_id,
                                    );
                                  }
                                  if (
                                    detailCol.accessorKey ===
                                    "aliquot_received_count"
                                  ) {
                                    rawValue = countCodes(
                                      row.original.aliquot_received_codes,
                                    );
                                  }
                                  if (
                                    detailCol.accessorKey ===
                                    "aliquot_missing_count"
                                  ) {
                                    const sent = countCodes(
                                      row.original.aliquot_id,
                                    );
                                    const received = countCodes(
                                      row.original.aliquot_received_codes,
                                    );
                                    rawValue = sent - received;
                                  }
                                }

                                // Remove null, undefined,false, and empty string values
                                if (
                                  rawValue === null ||
                                  rawValue === undefined ||
                                  rawValue === "" ||
                                  rawValue === false
                                ) {
                                  return null;
                                }
                                //  LOGIC FOR DATE FORMATTING:
                                let displayValue;

                                // Check if the value is a date
                                const isLikelyDate =
                                  rawValue instanceof Date ||
                                  (typeof rawValue === "string" &&
                                    /^\d{4}-\d{2}-\d{2}/.test(rawValue));

                                if (isLikelyDate) {
                                  displayValue = formatDateTime(rawValue);
                                } else if (rawValue === true) {
                                  displayValue = "Yes";
                                } else if (rawValue === false) {
                                  displayValue = "No";
                                } else if (
                                  typeof rawValue === "object" &&
                                  rawValue !== null
                                ) {
                                  try {
                                    displayValue = JSON.stringify(rawValue);
                                  } catch {
                                    displayValue = String(rawValue);
                                  }
                                } else {
                                  displayValue = String(rawValue);
                                }

                                return (
                                  <div
                                    key={detailCol.accessorKey}
                                    className="flex flex-col border border-gray-300 rounded p-2 bg-white min-w-[160px]"
                                  >
                                    <div className="text-xs whitespace-nowrap font-medium text-gray-700">
                                      {detailCol.header}
                                    </div>
                                    <div className="text-xs text-gray-900">
                                      {displayValue}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                </React.Fragment>
              );
            })}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr>
                <td
                  colSpan={table.getAllColumns().length}
                  style={{
                    height: `${rowVirtualizer.getTotalSize() -
                      (rowVirtualizer.getVirtualItems()[
                        rowVirtualizer.getVirtualItems().length - 1
                      ]?.end || 0)
                      }px`,
                  }}
                />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {columnFilters.length === 0 ? (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-gray-600">
            Showing {table.getRowModel().rows.length} of {initialRowData.length}{" "}
            records on this page
            {totalRows > pagination.pageSize &&
              ` (${totalRows} total records across all pages)`}
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>

            {/* Page Jump Controls */}
            <div className="flex items-center space-x-1">
              {(() => {
                const currentPage = table.getState().pagination.pageIndex + 1;
                const totalPages = table.getPageCount();
                const pageButtons = [];

                // Show first page
                if (currentPage > 2) {
                  pageButtons.push(
                    <Button
                      key={1}
                      variant={currentPage === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => table.setPageIndex(0)}
                      className="w-8 h-8 p-0"
                    >
                      1
                    </Button>,
                  );
                  if (currentPage > 3) {
                    pageButtons.push(
                      <span key="ellipsis1" className="px-1">
                        ...
                      </span>,
                    );
                  }
                }

                // Show pages around current page
                for (
                  let i = Math.max(1, currentPage - 1);
                  i <= Math.min(totalPages, currentPage + 1);
                  i++
                ) {
                  pageButtons.push(
                    <Button
                      key={i}
                      variant={currentPage === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => table.setPageIndex(i - 1)}
                      className="w-8 h-8 p-0"
                    >
                      {i}
                    </Button>,
                  );
                }

                // Show last page
                if (currentPage < totalPages - 1) {
                  if (currentPage < totalPages - 2) {
                    pageButtons.push(
                      <span key="ellipsis2" className="px-1">
                        ...
                      </span>,
                    );
                  }
                  pageButtons.push(
                    <Button
                      key={totalPages}
                      variant={
                        currentPage === totalPages ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => table.setPageIndex(totalPages - 1)}
                      className="w-8 h-8 p-0"
                    >
                      {totalPages}
                    </Button>,
                  );
                }

                return pageButtons;
              })()}
            </div>

            {/* Jump to Page Input */}
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min={1}
                max={table.getPageCount()}
                placeholder="Go to"
                className="w-20 h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const page = Number((e.target as HTMLInputElement).value);
                    if (page >= 1 && page <= table.getPageCount()) {
                      table.setPageIndex(page - 1);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-gray-600">
            Showing {table.getRowModel().rows.length} filtered record
            {table.getRowModel().rows.length !== 1 ? "s" : ""} from {totalRows}{" "}
            total records
          </div>
        </div>
      )}

      {/* Feedback Popup currently used in the genomics page */}
      {canSubmitGenomicsFeedback && (
        <FeedbackDialog
          open={groupDialogOpen}
          onOpenChange={setGroupDialogOpen}
          title="Submit Suspected cases for Genomics Feedback"
          schema="imdhub_core"
          tableName="suspected_cases"
          data={{
            suspected_case_id: selectedRow?.id,
            requested_by: session?.user?.email,
            committee_review: selectedRow?.committee_review,
          }}
          placeholder="Enter comment for the genomics group"
          onSuccess={refetchTable}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          confirmAction === "received"
            ? "Mark as received?"
            : "Mark as shipped?"
        }
        description={
          confirmAction === "received"
            ? "This will mark the shipment as received. After this action, the shipment will no longer be editable."
            : "This will mark the shipment as shipped. After this action, the shipment will no longer be editable."
        }
        confirmText={
          confirmAction === "received"
            ? "Yes, mark as received"
            : "Yes, mark as shipped"
        }
        variant="destructive"
        onConfirm={() => {
          if (!confirmRow || !confirmAction) return;

          handleShipmentShippedOrReceived(
            confirmRow,
            confirmAction === "received"
              ? "mark_shipment_as_received"
              : "mark_shipment_as_shipped"
          );

          setConfirmOpen(false);
          setConfirmRow(null);
          setConfirmAction(null);
        }}
      />
    </div>
  );
};

export default TanTable;
