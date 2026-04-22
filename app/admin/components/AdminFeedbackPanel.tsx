// reference implementation - see src/ for the npm package version
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminIdentity } from "@/hooks/use-admin-identity";
import { FeedbackData } from "@/app/feedbacks/types/feedback-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormStateProvider } from "@/hooks/form-state-provider";
import FeedbackForm from "@/app/feedbacks/form/feedback-form";

const STATUS_LABELS: Record<number, { label: string; classes: string }> = {
  1: { label: "Open", classes: "bg-blue-100 text-blue-700" },
  2: { label: "In Progress", classes: "bg-amber-100 text-amber-700" },
  3: { label: "Pending Review", classes: "bg-purple-100 text-purple-700" },
  4: { label: "Resolved", classes: "bg-green-100 text-green-700" },
  5: { label: "Closed", classes: "bg-slate-100 text-slate-600" },
  6: { label: "Won't Fix", classes: "bg-red-100 text-red-700" },
};

const STATUS_OPTIONS = [
  { value: 1, label: "Open" },
  { value: 2, label: "In Progress" },
  { value: 3, label: "Pending Review" },
  { value: 4, label: "Resolved" },
  { value: 5, label: "Closed" },
  { value: 6, label: "Won't Fix" },
];

async function adminAction(
  id: number,
  action: string,
  adminEmail: string,
  value?: number
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/admin/feedbacks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, admin_email: adminEmail, value }),
  });
  return res.json();
}

export default function AdminFeedbackPanel() {
  const { email } = useAdminIdentity();
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [editFeedback, setEditFeedback] = useState<FeedbackData | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/select?table=feedbacks&schema=imdhub_core&pageSize=200&__session_email=${encodeURIComponent(email)}`
      );
      const json = await res.json();
      setFeedbacks(json.data ?? []);
    } catch {
      setError("Failed to load feedbacks.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (email) fetchFeedbacks();
  }, [email, fetchFeedbacks]);

  async function handleAction(id: number, action: string, value?: number) {
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await adminAction(id, action, email, value);
      if (!res.success) {
        alert(res.error ?? "Action failed");
      } else {
        await fetchFeedbacks();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Soft-delete this feedback? It can be restored later.")) return;
    await handleAction(id, "delete");
  }

  const total = feedbacks.length;
  const openCount = feedbacks.filter((f) => f.feedback_status === 1).length;
  const inProgressCount = feedbacks.filter((f) => f.feedback_status === 2).length;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading feedbacks…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span className="rounded-md bg-slate-100 px-3 py-1.5 font-medium">
          Total: <strong className="text-slate-800">{total}</strong>
        </span>
        <span className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
          Open: <strong>{openCount}</strong>
        </span>
        <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
          In Progress: <strong>{inProgressCount}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Submitter</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Page</th>
              <th className="px-3 py-2 text-center">Threads</th>
              <th className="px-3 py-2 text-left">Flags</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feedbacks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  No feedbacks found.
                </td>
              </tr>
            ) : (
              feedbacks.map((fb) => {
                const statusInfo = STATUS_LABELS[fb.feedback_status] ?? {
                  label: fb.feedback_status_name ?? "—",
                  classes: "bg-slate-100 text-slate-600",
                };
                const isLoading = actionLoading === fb.id;

                return (
                  <tr
                    key={fb.id}
                    className={`hover:bg-slate-50 ${fb.soft_delete ? "opacity-50" : ""}`}
                  >
                    {/* Submitter */}
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">
                      {fb.submitter_ref ?? fb.email ?? "—"}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2 text-slate-600">
                      {fb.feedback_type_name ?? "—"}
                    </td>

                    {/* Status badge */}
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.classes}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Page */}
                    <td className="max-w-[160px] truncate px-3 py-2 text-xs text-slate-500">
                      {fb.page ?? "—"}
                    </td>

                    {/* Thread count */}
                    <td className="px-3 py-2 text-center text-slate-600">
                      {fb.thread_count ?? 0}
                    </td>

                    {/* Flags */}
                    <td className="px-3 py-2">
                      {fb.promote && (
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                          ⭐ Promoted
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {/* Status select */}
                        <select
                          disabled={isLoading}
                          value={fb.feedback_status}
                          onChange={(e) =>
                            handleAction(fb.id, "status", parseInt(e.target.value, 10))
                          }
                          className="rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        {/* Close */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 py-0 text-xs"
                          disabled={isLoading || fb.feedback_status === 5}
                          onClick={() => handleAction(fb.id, "close")}
                        >
                          Close
                        </Button>

                        {/* Promote */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 py-0 text-xs"
                          disabled={isLoading || Boolean(fb.promote)}
                          onClick={() => handleAction(fb.id, "promote")}
                        >
                          Promote
                        </Button>

                        {/* Delete / Restore */}
                        {fb.soft_delete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 py-0 text-xs text-green-700 hover:text-green-800"
                            disabled={isLoading}
                            onClick={() => handleAction(fb.id, "restore")}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 py-0 text-xs text-red-600 hover:text-red-700"
                            disabled={isLoading}
                            onClick={() => handleDelete(fb.id)}
                          >
                            Delete
                          </Button>
                        )}

                        {/* Edit */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 py-0 text-xs"
                          disabled={isLoading}
                          onClick={() => setEditFeedback(fb)}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {editFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditFeedback(null);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <button
              onClick={() => setEditFeedback(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              ✕
            </button>
            <h2 className="mb-4 text-base font-semibold text-slate-800">
              Edit Feedback #{editFeedback.id}
            </h2>
            <FormStateProvider>
              <FeedbackForm
                schema="imdhub_core"
                tableName="feedbacks"
                initialValues={editFeedback}
                onClose={() => setEditFeedback(null)}
                refetchTable={fetchFeedbacks}
              />
            </FormStateProvider>
          </div>
        </div>
      )}
    </div>
  );
}
