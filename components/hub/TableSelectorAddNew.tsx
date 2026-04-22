"use client";

import { Button } from "@/components/ui/button";

interface TableSelectorAddNewProps {
  tables: string[];
  selectedTable: string;
  setSelectedTable: (table: string) => void;
  fetchData: (table: string) => void;
  setEditingData: (data: unknown) => void;
  setOpen: (open: boolean) => void;
}

export function TableSelectorAddNew({
  tables,
  selectedTable,
  setSelectedTable,
  fetchData,
  setEditingData,
  setOpen,
}: TableSelectorAddNewProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
          Feedback Data
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            htmlFor="table-selector"
            className="text-sm font-medium text-slate-700"
          >
            Dataset
          </label>
          <select
            id="table-selector"
            value={selectedTable}
            onChange={(event) => setSelectedTable(event.target.value)}
            className="min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none ring-0 transition focus:border-cyan-700"
          >
            {tables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-md border-slate-300 bg-white px-3"
          onClick={() => fetchData(selectedTable)}
        >
          Reload
        </Button>
        <Button
          type="button"
          className="rounded-md bg-cyan-900 px-3 text-white hover:bg-cyan-800"
          onClick={() => {
            setEditingData(null);
            setOpen(true);
          }}
        >
          Add Feedback
        </Button>
      </div>
    </div>
  );
}
