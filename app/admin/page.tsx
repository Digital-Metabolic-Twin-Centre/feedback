"use client";

import BaseFormAuth from "@/layout/BaseFormAuth";
import { useAdminIdentity } from "@/hooks/use-admin-identity";
import AdminFeedbackPanel from "./components/AdminFeedbackPanel";

export default function AdminPage() {
  const { isAdmin, mounted } = useAdminIdentity();

  if (!mounted) return null;

  return (
    <BaseFormAuth title="Admin" subTitle="Feedback management">
      <div className="min-h-[60vh] space-y-4">
        {!isAdmin ? (
          <section className="page-section p-6">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-3xl">🔒</span>
              <h2 className="text-lg font-semibold text-slate-800">Access Denied</h2>
              <p className="max-w-sm text-sm text-slate-500">
                This area requires admin access. Please identify yourself with an
                admin email address using the menu at the top of the page.
              </p>
            </div>
          </section>
        ) : (
          <section className="page-section p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Feedback Management</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review, update status, promote, and manage all submitted feedbacks.
              </p>
            </div>
            <AdminFeedbackPanel />
          </section>
        )}
      </div>
    </BaseFormAuth>
  );
}
