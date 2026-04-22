import BaseFormAuth from "@/layout/BaseFormAuth";
import TableSelector from "./utils/table-selector";

export default function Page() {
  return (
    <BaseFormAuth title="Feedbacks" subTitle="Review and respond">
      <div className="min-h-[60vh] space-y-4">
        <section className="page-section p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Feedback Workspace
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Manage submissions, open a thread, and respond without leaving this page.
          </p>
        </section>

        <section className="page-section p-4 md:p-6">
          <TableSelector tables={["feedbacks"]} />
        </section>
      </div>
    </BaseFormAuth>
  );
}
