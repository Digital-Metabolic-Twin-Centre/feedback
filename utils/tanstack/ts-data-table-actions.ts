"use client";

import { useSharedFormState } from "@/hooks/form-state-provider";

export const TanTableActions = <T extends { [key: string]: unknown; monthYearOfBirth?: string | Date }>() => {
  const {
    editingData,
    setEditingData,
    open,
    setOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    buttonClicked,
    // setButtonClicked,
    actionTriggered,
    setActionTriggered,
    actionRow,
    setActionRow,
  } = useSharedFormState();

  // Edit action: transform the row data and open the edit form.
  const handleEdit = (rowData: T) => {
    setEditingData(rowData);
    setOpen(true);

  };

  // Trash action: mark the row for soft deletion.
  const handleTrash = (rowData: T) => {
    setActionRow(rowData);
    setActionTriggered("Trash");
    setConfirmDialogOpen(true);
  };

  // Restore action: mark the row for restoration.
  const handleRestore = (rowData: T) => {
    setActionRow(rowData);
    setActionTriggered("Restore");
    setConfirmDialogOpen(true);
  };

  // Delete action: mark the row for permanent deletion.
  const handleDelete = (rowData: T) => {
    setActionRow(rowData);
    setActionTriggered("Delete");
    setConfirmDialogOpen(true);
  };

  // Close the dialog and reset the state.
 const handleClose = () => {
    setOpen(false);
    setEditingData(null);
    setActionRow("");
    setActionTriggered("");
  };

  return {
    handleEdit,
    handleTrash,
    handleRestore,
    handleDelete,
    handleClose,
    // Optionally, return additional state if needed in the consuming component.
    editingData,
    open,
    confirmDialogOpen,
    buttonClicked,
    actionTriggered,
    actionRow,
  };
};
