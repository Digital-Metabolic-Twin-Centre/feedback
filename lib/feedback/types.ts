export interface FeedbackData {
  id: number;
  project_id?: number | null;
  email: string | null;
  submitter_ref: string | null;
  organisation: number;
  organisation_name?: string | null;
  page: string | null;
  initial_message?: string | null;
  feedback_type: number;
  feedback_type_name?: string | null;
  feedback_status: number;
  feedback_status_name?: string | null;
  promote: boolean | null;
  thread_count?: number | null;
  latest_thread_message?: string | null;
  latest_thread_author_role?: "User" | "Admin" | null;
  draft: boolean | null;
  soft_delete: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface FeedbackThreadMessage {
  id: number;
  feedback_id: number;
  author_role: "User" | "Admin";
  message: string;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}
