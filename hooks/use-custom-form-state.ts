import { useState } from "react";
import { ForeignOption } from "@/types/common";
import {
  ParticipantRegistrationTabKey,
  BiospecimenTabKey,
} from "@/lib/constants";

type SubmitStatus = "idle" | "loading" | "success" | "error";
type loadingStatus = "loading" | "idle";

export const useFormState = () => {
  const [foreignOptions, setForeignOptions] = useState<
    Record<string, ForeignOption[]>
  >({});

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [loadingStatus, setLoadingStatus] = useState<loadingStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    ParticipantRegistrationTabKey | BiospecimenTabKey
  >();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingData, setEditingData] = useState<any>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionRow, setActionRow] = useState<any>(null);

  // Monitor events being triggered like Trash, Restore, Delete
  const [actionTriggered, setActionTriggered] = useState<string>();

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Disable buttons after click
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);

  // Monitor state of dialog box
  const [open, setOpen] = useState(false);

  // For filtering the tables based on soft deleted records
  // Change the state type to accept "active" | "trashed" | "both"
  const [softDeleteFilter, setSoftDeleteFilter] = useState<
    "All" | "Active" | "Trashed" | "Draft"
  >("All");

  const [statusFilter, setStatusFilter] = useState<
    "All" | "Available" | "Assigned" | "Withdrawn"
  >("All");

  // New Hooks
  const [selectedTable, setSelectedTable] = useState<string>("");

  // Pagination
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [totalRows, setTotalRows] = useState(0);

  return {
    // Foreign key options
    foreignOptions,
    setForeignOptions,

    submitStatus,
    setSubmitStatus,
    errorMessage,
    setErrorMessage,
    activeTab,
    setActiveTab,
    editingData,
    setEditingData,
    open,
    setOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    buttonClicked,
    setButtonClicked,
    softDeleteFilter,
    setSoftDeleteFilter,
    actionTriggered,
    setActionTriggered,
    actionRow,
    setActionRow,
    loadingStatus,
    setLoadingStatus,

    // Ontologies based table selection
    selectedTable,
    setSelectedTable,

    // Participant stautus on identifier table
    statusFilter,
    setStatusFilter,

    pagination,
    setPagination,
    totalRows,
    setTotalRows,
  };
};
