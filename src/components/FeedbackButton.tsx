"use client";
import React from "react";

export interface FeedbackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function FeedbackButton({ onClick, label = "Feedback", className }: FeedbackButtonProps) {
  return (
    <button
      className={className ?? "fb-trigger-btn"}
      onClick={onClick}
      aria-label={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span>{label}</span>
    </button>
  );
}
