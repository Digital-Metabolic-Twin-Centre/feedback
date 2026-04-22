"use client";

import React from "react";
import TanTable from "@/utils/tanstack/ts-data-table";
import { ColumnDefinition, DetailColumns } from "../utils/column-def";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useSharedFormState } from "@/hooks/form-state-provider";
import { TanTableActions } from "@/utils/tanstack/ts-data-table-actions";
import { toast } from "sonner";
import FeedbackForm from "./feedback-form";
import { FeedbackData } from "../types/feedback-types";
import { secureFetch } from "@/hooks/secure-fetch";
import { API_ENDPOINTS } from "@/lib/urls";
import { PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface EditPageProps {
  tableData: FeedbackData[];
  refetchTable: () => void;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  tableName?: string;
  schema?: string;
}

// Column that should be removed from the table
const filteredColumnsDefinition = ColumnDefinition.filter(
  ({ accessorKey }) =>
    !["clinical_site", "feedback_type", "feedback_status", "id"].includes(
      accessorKey,
    ),
);

export default function EditPage({
  tableData,
  refetchTable,
  pagination,
  setPagination,
  tableName,
  schema,
}: EditPageProps) {
  const {
    editingData,
    open,
    setOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    buttonClicked,
    setButtonClicked,
    actionTriggered,
    actionRow,
    selectedTable,
  } = useSharedFormState();

  const { handleEdit, handleTrash, handleRestore, handleDelete, handleClose } =
    TanTableActions();
  return (
    <>
      <TanTable
        initialRowData={tableData}
        initialColumnDef={filteredColumnsDefinition}
        detailColumnDef={DetailColumns}
        pagination={pagination}
        setPagination={setPagination}
        onEdit={handleEdit}
        onTrash={handleTrash}
        onRestore={handleRestore}
        onDelete={handleDelete}
        tableName={tableName}
        schema={schema}
        refetchTable={refetchTable}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed top-0 w-[94vw] max-w-none -translate-x-1/2 bg-transparent p-0 shadow-none md:left-1/2 md:top-1/2 md:w-[680px] lg:w-[760px] md:-translate-y-1/2"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <DialogHeader className="border-b border-slate-200 px-4 py-3 md:px-5 md:py-4">
              <DialogTitle className="text-lg text-slate-900">
                {editingData ? "Feedback Thread" : "Create Feedback"}
                <p className="mt-1 font-sans text-xs font-medium text-slate-500">
                  Review and response
                </p>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Please avoid including any personally identifiable information (PII) in the thread messages.
              </p>
              <DialogDescription />
            </DialogHeader>

            <FeedbackForm
              initialValues={editingData ?? undefined}
              onClose={handleClose}
              schema="imdhub_core"
              tableName="feedbacks"
              refetchTable={refetchTable}
            />
          </div>
        </DialogContent>
      </Dialog>

      {confirmDialogOpen && (
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="rounded-[28px] border border-white/70 bg-white/95 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.8)]">
            <DialogHeader>
              <DialogTitle>Confirm {actionTriggered}</DialogTitle>
              <DialogDescription>
                Are you sure you want to {actionTriggered?.toLowerCase()} this
                record?
                {actionTriggered === "Delete" && (
                  <span className="block font-bold mt-2 text-red-600">
                    THIS ACTION IS PERMANENT AND CANNOT BE REVERSED.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-4 ">
              <Button
                disabled={buttonClicked}
                variant="destructive"
                onClick={async () => {
                  if (!actionRow) return;

                  setButtonClicked(true);
                  try {
                    const res = await secureFetch(API_ENDPOINTS.DELETE, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        schema: "imdhub_core",
                        tableName: selectedTable,
                        where: { id: actionRow.id },
                        restoreAction: actionTriggered,
                      }),
                    });

                    const result = await res.json();

                    if (result.success) {
                      if (result.action === "trashed") {
                        toast.warning("Entry moved to trash.");
                      } else if (result.action === "restore") {
                        toast.info("Entry restored.");
                      } else {
                        toast.success("Entry permanently deleted.");
                      }
                      refetchTable();
                    } else {
                      toast.error(result.message);
                    }
                  } catch (err: unknown) {
                    const message =
                      err instanceof Error ? err.message : "Unknown error";
                    toast.error(message);
                  } finally {
                    setButtonClicked(false);
                    setConfirmDialogOpen(false);
                  }
                }}
              >
                Yes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
