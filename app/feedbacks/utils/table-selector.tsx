"use client";

import  { useEffect, useState, useCallback } from "react";
import EditPage from "../form/edit-page";
import { type FeedbackData } from "../types/feedback-types";
import { useSharedFormState } from "@/hooks/form-state-provider";
import Loading from "@/app/loading";
import { TableSelectorAddNew } from "@/components/hub/TableSelectorAddNew";
import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS } from "@/lib/urls";
import { useAdminIdentity } from "@/hooks/use-admin-identity";

export default function TableSelector({ tables }: { tables: string[] }) {
  const [data, setData] = useState<FeedbackData[] | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { email: identityEmail } = useAdminIdentity();

  const {
    selectedTable,
    setSelectedTable,
    loadingStatus,
    setLoadingStatus,
    errorMessage,
    setErrorMessage,
    setEditingData,
    setOpen,
    pagination,
    setPagination,
    setTotalRows,
    softDeleteFilter,
  } = useSharedFormState();

  const fetchData = useCallback(
    async (tableName: string, pageIndex: number, pageSize: number) => {
      if (!hasLoadedOnce) {
        setLoadingStatus("loading");
      }
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          table: tableName,
          schema: "imdhub_core",
          page: String(pageIndex + 1),
          pageSize: String(pageSize),
        });

        if (identityEmail) {
          params.set("__session_email", identityEmail);
        }

        if (softDeleteFilter === "Trashed") {
          params.set("soft_delete", "true");
        } else if (softDeleteFilter === "Draft") {
          params.set("draft", "true");
        } else if (softDeleteFilter === "Active") {
          params.set("soft_delete", "false");
          params.set("draft", "false");
        }

        const res = await secureFetch(
          `${API_ENDPOINTS.SELECT}?${params.toString()}`
        );

        const json = await res.json();

        if (!json.success) {
          throw new Error(json.message);
        }
        setData(json.data as FeedbackData[]);
        setTotalRows(json.meta?.total ?? 0);

        if (!hasLoadedOnce) {
          setHasLoadedOnce(true);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load data";
        setErrorMessage(message);
        setData(null);
      } finally {
        setLoadingStatus("idle");
      }
    },
    [hasLoadedOnce, setLoadingStatus, setErrorMessage, setData, setTotalRows, softDeleteFilter, identityEmail]
  );

  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0]);
    }
  }, [selectedTable, tables, setSelectedTable]);

  useEffect(() => {
    if (!selectedTable) return;
    fetchData(selectedTable, pagination.pageIndex, pagination.pageSize);
  }, [selectedTable, pagination.pageIndex, pagination.pageSize, fetchData, softDeleteFilter]);

  return (
    <div className="space-y-6">
      <TableSelectorAddNew
        tables={tables}
        selectedTable={selectedTable}
        setSelectedTable={setSelectedTable}
        fetchData={(table) =>
          fetchData(table, pagination.pageIndex, pagination.pageSize)
        }
        setEditingData={setEditingData}
        setOpen={setOpen}
      />

      {/* Status */}
      {loadingStatus === "loading" && !hasLoadedOnce && <Loading />}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error: {errorMessage}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Active Dataset
              </p>
              <p className="text-lg text-slate-900">{selectedTable}</p>
            </div>
            <p className="text-sm text-slate-600">
              Page {pagination.pageIndex + 1} with {pagination.pageSize} rows per view.
            </p>
          </div>
          <EditPage
            tableData={data}
            refetchTable={() =>
              fetchData(selectedTable, pagination.pageIndex, pagination.pageSize)
            }
            pagination={pagination}
            setPagination={setPagination}
            tableName={selectedTable}
            schema="imdhub_core"
          />
        </div>
      )}
    </div>
  );
}
