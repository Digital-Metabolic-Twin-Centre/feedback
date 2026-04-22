"use client";
import React, { useState } from "react";
import { FeedbackForm, type FeedbackFormProps } from "./FeedbackForm";

export interface FeedbackWidgetProps extends Omit<FeedbackFormProps, "onClose" | "isAdmin"> {
  buttonLabel?: string;
  buttonClassName?: string;
  modalClassName?: string;
  adminEmails?: string[];
  currentUserEmail?: string;
}

export function FeedbackWidget({
  buttonLabel = "Feedback",
  buttonClassName,
  modalClassName,
  adminEmails = [],
  currentUserEmail,
  defaultPage,
  ...formProps
}: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);

  const isAdmin = !!currentUserEmail &&
    adminEmails.map(e => e.toLowerCase()).includes(currentUserEmail.toLowerCase());

  const page = defaultPage ?? (typeof window !== "undefined" ? window.location.pathname : "");

  return (
    <>
      <button
        className={buttonClassName ?? "fb-trigger-btn"}
        onClick={() => setOpen(true)}
        aria-label={buttonLabel}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div className="fb-modal-overlay" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className={`fb-modal ${modalClassName ?? ""}`}>
            <div className="fb-modal-header">
              <h2 className="fb-modal-title">Submit Feedback</h2>
              <button className="fb-modal-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="fb-modal-body">
              <FeedbackForm
                {...formProps}
                defaultPage={page}
                defaultEmail={currentUserEmail}
                isAdmin={isAdmin}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
