import { formatDateCell } from "@/hooks/utc-to-localdate";
import { FeedbackCommentContent } from "./comment-rich-text";

const yesNoCell = (value: boolean | null) =>
  value === true ? "Yes" : value === false ? "No" : "N/A";

const ColumnDefinition = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "clinical_site_name", header: "Clinical Site" },
  { accessorKey: "submitter_ref", header: "Submitter Ref" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "page", header: "Page" },
  {
    accessorKey: "latest_thread_message",
    header: "Latest Reply",
    cell: ({ getValue }: { getValue: () => string | null }) => (
      <div className="max-w-xl py-1">
        <FeedbackCommentContent value={getValue()} />
      </div>
    ),
  },
  { accessorKey: "feedback_type_name", header: "Feedback Type" },
  { accessorKey: "feedback_status_name", header: "Feedback Status" },
  { accessorKey: "thread_count", header: "Replies" },
  {
    accessorKey: "promote",
    header: "Gitlab Issue",
    cell: ({ getValue }: { getValue: () => boolean | null }) =>
      yesNoCell(getValue()),
  },
  {
    accessorKey: "draft",
    header: "Draft",
    cell: ({ getValue }: { getValue: () => boolean | null }) =>
      yesNoCell(getValue()),
  },
  {
    accessorKey: "soft_delete",
    header: "Trashed",
    cell: ({ getValue }: { getValue: () => boolean | null }) =>
      yesNoCell(getValue()),
  },
  { accessorKey: "created_by", header: "Created By" },
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ getValue }: { getValue: () => string | null }) =>
      formatDateCell(getValue()),
  },
  { accessorKey: "updated_by", header: "Updated By" },
  {
    accessorKey: "updated_at",
    header: "Updated At",
    cell: ({ getValue }: { getValue: () => string | null }) =>
      formatDateCell(getValue()),
  },
];

const DetailColumns = [
  "latest_thread_message",
  "draft",
  "soft_delete",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
];

export { ColumnDefinition, DetailColumns };
