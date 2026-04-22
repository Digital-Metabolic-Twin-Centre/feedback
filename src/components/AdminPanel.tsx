"use client";
import React, { useCallback, useState } from "react";
import { useFeedbacks } from "../hooks/useFeedbacks";
import { FeedbackForm } from "./FeedbackForm";
import type { FeedbackData } from "../types";
import { apiFetch } from "../lib/apiFetch";
import { toast } from "sonner";

export interface AdminPanelProps {
  feedbacksEndpoint?: string;
  formEndpoint?: string;
  metaEndpoint?: string;
  adminEmail: string;
  token?: string;
  apiKey?: string;
  onPromote?: (feedback: FeedbackData) => void;
  className?: string;
}

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Open", color: "#1d4ed8" },
  2: { label: "In Progress", color: "#b45309" },
  3: { label: "Pending Review", color: "#6d28d9" },
  4: { label: "Resolved", color: "#15803d" },
  5: { label: "Closed", color: "#475569" },
  6: { label: "Won't Fix", color: "#dc2626" },
};

const STATUS_OPTIONS = [
  { value: 1, label: "Open" },
  { value: 2, label: "In Progress" },
  { value: 3, label: "Pending Review" },
  { value: 4, label: "Resolved" },
  { value: 5, label: "Closed" },
  { value: 6, label: "Won't Fix" },
];

export function AdminPanel({
  feedbacksEndpoint = "/api/v1/admin/feedbacks",
  formEndpoint = "/api/v1/feedbacks",
  metaEndpoint = "/api/v1/feedbacks/meta",
  adminEmail,
  token,
  apiKey,
  onPromote,
  className,
}: AdminPanelProps) {
  const { feedbacks, loading, error, refetch } = useFeedbacks({
    endpoint: feedbacksEndpoint,
    adminEmail,
    token,
    apiKey,
    enabled: !!adminEmail,
  });

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [editFeedback, setEditFeedback] = useState<FeedbackData | null>(null);

  const patchFeedback = useCallback(async (id: number, body: object) => {
    const res = await apiFetch(`${feedbacksEndpoint}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...body, admin_email: adminEmail }),
      token,
      apiKey,
    });
    return res.json();
  }, [feedbacksEndpoint, adminEmail, token, apiKey]);

  async function handleAction(id: number, action: string, value?: number) {
    if (actionLoading !== null) return;
    setActionLoading(id);
    try {
      const res = await patchFeedback(id, { action, value });
      if (!res.success) {
        toast.error(res.error ?? "Action failed");
      } else {
        await refetch();
        if (action === "promote") {
          const fb = feedbacks.find(f => f.id === id);
          if (fb) onPromote?.(fb);
        }
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Soft-delete this feedback?")) return;
    await handleAction(id, "delete");
  }

  const total = feedbacks.length;
  const openCount = feedbacks.filter(f => f.feedback_status === 1).length;
  const inProgressCount = feedbacks.filter(f => f.feedback_status === 2).length;

  if (loading) return <p className="fb-loading">Loading feedbacks…</p>;
  if (error) return <p className="fb-error-msg">{error}</p>;

  return (
    <div className={`fb-admin ${className ?? ""}`}>
      <div className="fb-admin-summary">
        <span className="fb-stat">Total: <strong>{total}</strong></span>
        <span className="fb-stat fb-stat-open">Open: <strong>{openCount}</strong></span>
        <span className="fb-stat fb-stat-progress">In Progress: <strong>{inProgressCount}</strong></span>
      </div>

      <div className="fb-admin-table-wrapper">
        <table className="fb-admin-table">
          <thead>
            <tr>
              <th>Submitter</th><th>Type</th><th>Status</th><th>Page</th><th>Threads</th><th>Flags</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.length === 0 ? (
              <tr><td colSpan={7} className="fb-empty">No feedbacks found.</td></tr>
            ) : (
              feedbacks.map(fb => {
                const statusInfo = STATUS_LABELS[fb.feedback_status] ?? { label: fb.feedback_status_name ?? "—", color: "#475569" };
                const isLoading = actionLoading === fb.id;
                return (
                  <tr key={fb.id} className={fb.soft_delete ? "fb-row-deleted" : ""}>
                    <td>{fb.submitter_ref ?? fb.email ?? "—"}</td>
                    <td>{fb.feedback_type_name ?? "—"}</td>
                    <td>
                      <span className="fb-badge" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="fb-truncate">{fb.page ?? "—"}</td>
                    <td className="fb-center">{fb.thread_count ?? 0}</td>
                    <td>{fb.promote && <span className="fb-badge">⭐ Promoted</span>}</td>
                    <td>
                      <div className="fb-actions">
                        <select
                          disabled={isLoading}
                          value={fb.feedback_status}
                          onChange={e => handleAction(fb.id, "status", parseInt(e.target.value, 10))}
                          className="fb-select-sm"
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button className="fb-btn-sm" disabled={isLoading || fb.feedback_status === 5} onClick={() => handleAction(fb.id, "close")}>Close</button>
                        <button className="fb-btn-sm" disabled={isLoading || Boolean(fb.promote)} onClick={() => handleAction(fb.id, "promote")}>Promote</button>
                        {fb.soft_delete
                          ? <button className="fb-btn-sm fb-btn-restore" disabled={isLoading} onClick={() => handleAction(fb.id, "restore")}>Restore</button>
                          : <button className="fb-btn-sm fb-btn-danger" disabled={isLoading} onClick={() => handleDelete(fb.id)}>Delete</button>
                        }
                        <button className="fb-btn-sm" disabled={isLoading} onClick={() => setEditFeedback(fb)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editFeedback && (
        <div className="fb-modal-overlay" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setEditFeedback(null); }}>
          <div className="fb-modal">
            <div className="fb-modal-header">
              <h2 className="fb-modal-title">Edit Feedback #{editFeedback.id}</h2>
              <button className="fb-modal-close" onClick={() => setEditFeedback(null)} aria-label="Close">✕</button>
            </div>
            <div className="fb-modal-body">
              <FeedbackForm
                endpoint={formEndpoint}
                metaEndpoint={metaEndpoint}
                token={token}
                apiKey={apiKey}
                initialValues={editFeedback}
                isAdmin={true}
                onClose={() => setEditFeedback(null)}
                onSuccess={async () => { setEditFeedback(null); await refetch(); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
