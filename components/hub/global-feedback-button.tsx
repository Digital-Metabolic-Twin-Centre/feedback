// reference implementation - see src/ for the npm package version
"use client";

import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { SITE_PATHS } from "@/lib/urls";

export function GlobalFeedbackButton() {
  return (
    <Link
      href={SITE_PATHS.FEEDBACKS}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-cyan-900 px-4 py-3 text-sm font-medium text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-cyan-800"
    >
      <MessageSquarePlus className="size-4" />
      <span>Feedback</span>
    </Link>
  );
}
