/**
 * SQLite-backed CRUD helpers for all feedback-related tables.
 *
 * These are the single source of truth for feedback data; PostgreSQL
 * is not consulted for any of the tables handled here.
 */

import { feedbackDb as db } from "@/lib/db-sqlite";
import { deriveSubmitterRef } from "@/lib/feedback/submitter-ref";
import type { FeedbackData, FeedbackThreadMessage } from "@/lib/feedback/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RefRow = { id: number; name: string; label: string | null };

export type InsertFeedbackInput = {
  project_id?: number | null;
  email: string;
  organisation?: number | null;
  page?: string | null;
  feedback_type?: number | null;
  feedback_status?: number | null;
  promote?: boolean;
  draft?: boolean;
  created_by?: string;
  updated_by?: string;
  [key: string]: unknown;
};

export type UpdateFeedbackInput = {
  id: number;
  updates: Record<string, unknown>;
};

// ── Reference tables ──────────────────────────────────────────────────────────

export function getFeedbackTypes(): RefRow[] {
  return db
    .prepare(
      `SELECT id, name, label FROM feedback_types
       WHERE soft_delete = 0 AND draft = 0
       ORDER BY id ASC`
    )
    .all() as RefRow[];
}

export function getFeedbackStatuses(): RefRow[] {
  return db
    .prepare(
      `SELECT id, name, label FROM feedback_status
       WHERE soft_delete = 0 AND draft = 0
       ORDER BY id ASC`
    )
    .all() as RefRow[];
}

export function getOrganisations(filters: Record<string, string> = {}): RefRow[] {
  const isDraft = filters.draft === "true";
  const isTrashed = filters.soft_delete === "true";

  let sql = `SELECT id, name, label, country FROM organisations`;
  if (isTrashed) {
    sql += ` WHERE soft_delete = 1`;
  } else if (isDraft) {
    sql += ` WHERE draft = 1 AND soft_delete = 0`;
  } else {
    sql += ` WHERE soft_delete = 0 AND draft = 0`;
  }
  sql += ` ORDER BY name ASC`;

  return db.prepare(sql).all() as RefRow[];
}

// ── Feedbacks ─────────────────────────────────────────────────────────────────

export function selectFeedbacks(
  filters: Record<string, string> = {},
  groups: string[] = [],
  pagination?: { page: number; pageSize: number },
  projectId?: number
): { data: FeedbackData[]; total: number } {
  const isAdmin = groups.length > 0;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  const isTrashed = filters.soft_delete === "true";
  const isDraft = filters.draft === "true";
  const isActive = filters.soft_delete === "false" && filters.draft === "false";

  if (isTrashed) {
    whereClauses.push(`f.soft_delete = 1`);
  } else if (isDraft) {
    whereClauses.push(`f.draft = 1`);
  } else if (isActive) {
    whereClauses.push(`f.soft_delete = 0 AND f.draft = 0`);
  }

  if (!isAdmin && filters.__session_email) {
    whereClauses.push(`LOWER(TRIM(f.email)) = LOWER(TRIM(?))`);
    params.push(filters.__session_email);
  }

  if (projectId) {
    whereClauses.push(`f.project_id = ?`);
    params.push(projectId);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const baseQuery = `
    SELECT
      f.id,
      f.project_id,
      f.email,
      f.submitter_ref,
      f.organisation,
      o.name   AS organisation_name,
      f.page,
      f.feedback_type,
      ft.name  AS feedback_type_name,
      f.feedback_status,
      fs.name  AS feedback_status_name,
      f.promote,
      COALESCE(msg_count.thread_count, 0) AS thread_count,
      latest_msg.message                  AS latest_thread_message,
      latest_msg.author_role              AS latest_thread_author_role,
      f.draft,
      f.soft_delete,
      f.created_by,
      f.created_at,
      f.updated_by,
      f.updated_at
    FROM feedbacks f
    LEFT JOIN organisations     o  ON f.organisation   = o.id
    LEFT JOIN feedback_types    ft ON f.feedback_type   = ft.id
    LEFT JOIN feedback_status   fs ON f.feedback_status = fs.id
    LEFT JOIN (
      SELECT feedback_id, COUNT(*) AS thread_count
      FROM feedback_messages
      WHERE soft_delete = 0
      GROUP BY feedback_id
    ) msg_count ON msg_count.feedback_id = f.id
    LEFT JOIN (
      SELECT m1.feedback_id, m1.message, m1.author_role
      FROM feedback_messages m1
      WHERE m1.soft_delete = 0
        AND m1.id = (
          SELECT m2.id
          FROM feedback_messages m2
          WHERE m2.feedback_id = m1.feedback_id AND m2.soft_delete = 0
          ORDER BY m2.created_at DESC, m2.id DESC
          LIMIT 1
        )
    ) latest_msg ON latest_msg.feedback_id = f.id
    ${where}
    ORDER BY f.updated_at DESC, f.id DESC
  `;

  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM feedbacks f ${where}`).get(...params) as { c: number }
  ).c;

  let rows: FeedbackData[];
  if (pagination) {
    const { page, pageSize } = pagination;
    rows = db
      .prepare(`${baseQuery} LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize) as FeedbackData[];
  } else {
    rows = db.prepare(baseQuery).all(...params) as FeedbackData[];
  }

  // SQLite returns 0/1 for booleans — coerce to boolean
  rows = rows.map((r) => ({
    ...r,
    promote:     Boolean(r.promote),
    draft:       Boolean(r.draft),
    soft_delete: Boolean(r.soft_delete),
  }));

  return { data: rows, total };
}

export function getFeedbackById(
  feedbackId: number,
  projectId?: number
): FeedbackData | null {
  const row = db
    .prepare(
      `SELECT
         f.id,
         f.project_id,
         f.email,
         f.submitter_ref,
         f.organisation,
         o.name   AS organisation_name,
         f.page,
         f.feedback_type,
         ft.name  AS feedback_type_name,
         f.feedback_status,
         fs.name  AS feedback_status_name,
         f.promote,
         COALESCE(msg_count.thread_count, 0) AS thread_count,
         latest_msg.message                  AS latest_thread_message,
         latest_msg.author_role              AS latest_thread_author_role,
         f.draft,
         f.soft_delete,
         f.created_by,
         f.created_at,
         f.updated_by,
         f.updated_at
       FROM feedbacks f
       LEFT JOIN organisations     o  ON f.organisation   = o.id
       LEFT JOIN feedback_types    ft ON f.feedback_type   = ft.id
       LEFT JOIN feedback_status   fs ON f.feedback_status = fs.id
       LEFT JOIN (
         SELECT feedback_id, COUNT(*) AS thread_count
         FROM feedback_messages
         WHERE soft_delete = 0
         GROUP BY feedback_id
       ) msg_count ON msg_count.feedback_id = f.id
       LEFT JOIN (
         SELECT m1.feedback_id, m1.message, m1.author_role
         FROM feedback_messages m1
         WHERE m1.soft_delete = 0
           AND m1.id = (
             SELECT m2.id
             FROM feedback_messages m2
             WHERE m2.feedback_id = m1.feedback_id AND m2.soft_delete = 0
             ORDER BY m2.created_at DESC, m2.id DESC
             LIMIT 1
           )
       ) latest_msg ON latest_msg.feedback_id = f.id
       WHERE f.id = ? ${projectId ? "AND f.project_id = ?" : ""}
       LIMIT 1`
    )
    .get(...(projectId ? [feedbackId, projectId] : [feedbackId])) as FeedbackData | undefined;

  if (!row) return null;

  return {
    ...row,
    promote: Boolean(row.promote),
    draft: Boolean(row.draft),
    soft_delete: Boolean(row.soft_delete),
  };
}

export function insertFeedback(data: InsertFeedbackInput): { insertedId: number } {
  const now = new Date().toISOString();
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const submitter_ref = deriveSubmitterRef(email);
  const defaultProject = db
    .prepare(`SELECT id FROM projects WHERE slug = 'default' LIMIT 1`)
    .get() as { id: number } | undefined;
  const projectId = data.project_id ?? defaultProject?.id ?? null;

  // Resolve status to "Open" by default if not provided
  let feedbackStatus = data.feedback_status ?? null;
  if (!feedbackStatus) {
    const openStatus = db
      .prepare(`SELECT id FROM feedback_status WHERE LOWER(name) = 'open' LIMIT 1`)
      .get() as { id: number } | undefined;
    if (openStatus) feedbackStatus = openStatus.id;
  }

  const result = db
    .prepare(
      `INSERT INTO feedbacks
         (project_id, email, submitter_ref, organisation, page, feedback_type, feedback_status,
          promote, draft, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(
      projectId,
      email,
      submitter_ref,
      data.organisation ?? null,
      data.page ?? null,
      data.feedback_type ?? null,
      feedbackStatus,
      data.promote ? 1 : 0,
      data.draft ? 1 : 0,
      data.created_by || "anonymous",
      now,
      data.updated_by || data.created_by || "anonymous",
      now
    ) as { id: number };

  return { insertedId: result.id };
}

export function updateFeedback(
  id: number,
  updates: Record<string, unknown>,
  projectId?: number
): { rowCount: number } | { error: string } {
  // Prevent un-promoting an already-promoted feedback
  if (updates.promote === false || updates.promote === 0) {
    const existing = db
      .prepare(
        `SELECT promote FROM feedbacks WHERE id = ? ${projectId ? "AND project_id = ?" : ""}`
      )
      .get(...(projectId ? [id, projectId] : [id])) as { promote: number } | undefined;

    if (existing?.promote === 1) {
      return { error: "Promoted feedback cannot be unpromoted." };
    }
  }

  const now = new Date().toISOString();
  const allowed = new Set([
    "email", "organisation", "page", "feedback_type", "feedback_status",
    "promote", "draft", "soft_delete", "updated_by",
  ]);

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(updates)) {
    if (!allowed.has(key)) continue;
    let v = val;
    // coerce booleans to integers for SQLite
    if (typeof v === "boolean") v = v ? 1 : 0;
    setClauses.push(`${key} = ?`);
    values.push(v);
  }

  if (updates.email && typeof updates.email === "string") {
    const email = updates.email.trim().toLowerCase();
    setClauses.push(`submitter_ref = ?`);
    values.push(deriveSubmitterRef(email));
  }

  setClauses.push(`updated_at = ?`);
  values.push(now);
  if (projectId) {
    values.push(id, projectId);
  } else {
    values.push(id);
  }

  const result = db
    .prepare(
      `UPDATE feedbacks SET ${setClauses.join(", ")} WHERE id = ? ${projectId ? "AND project_id = ?" : ""}`
    )
    .run(...values);

  return { rowCount: result.changes };
}

// ── Thread messages ────────────────────────────────────────────────────────────

export function getFeedbackOwner(
  feedbackId: number,
  projectId?: number
): { email: string; status_name: string } | undefined {
  return db
    .prepare(
      `SELECT f.email, fs.name AS status_name
       FROM feedbacks f
       LEFT JOIN feedback_status fs ON f.feedback_status = fs.id
       WHERE f.id = ? ${projectId ? "AND f.project_id = ?" : ""}`
    )
    .get(...(projectId ? [feedbackId, projectId] : [feedbackId])) as { email: string; status_name: string } | undefined;
}

export function getThreadMessages(
  feedbackId: number,
  projectId?: number
): FeedbackThreadMessage[] {
  return db
    .prepare(
      `SELECT id, feedback_id, author_role, message,
              created_by, created_at, updated_by, updated_at
       FROM feedback_messages m
       WHERE feedback_id = ?
         AND soft_delete = 0
         AND EXISTS (
           SELECT 1 FROM feedbacks f
           WHERE f.id = m.feedback_id
           ${projectId ? "AND f.project_id = ?" : ""}
         )
       ORDER BY created_at ASC, id ASC`
    )
    .all(...(projectId ? [feedbackId, projectId] : [feedbackId])) as FeedbackThreadMessage[];
}

export function insertThreadMessage(input: {
  feedbackId: number;
  authorRole: "User" | "Admin";
  message: string;
  createdBy: string;
}): void {
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO feedback_messages
         (feedback_id, author_role, message, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.feedbackId,
      input.authorRole,
      input.message,
      input.createdBy,
      now,
      input.createdBy,
      now
    );

    db.prepare(
      `UPDATE feedbacks SET updated_by = ?, updated_at = ? WHERE id = ?`
    ).run(input.createdBy, now, input.feedbackId);
  })();
}

// ── GitLab sync helpers ───────────────────────────────────────────────────────

export type FeedbackForGitLab = {
  id: number;
  submitter_ref: string | null;
  organisation_name: string | null;
  page: string | null;
  feedback_type_name: string | null;
  feedback_status_name: string | null;
  promote: boolean;
  draft: boolean;
  gitlab_issue_iid: number | null;
  gitlab_issue_url: string | null;
  promoted_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type FeedbackMessageForGitLab = {
  id: number;
  author_role: "User" | "Admin";
  message: string;
  created_by: string | null;
  created_at: string | null;
};

export function loadFeedbackForGitLab(feedbackId: number): {
  feedback: FeedbackForGitLab | null;
  thread: FeedbackMessageForGitLab[];
} {
  const row = db
    .prepare(
      `SELECT
         f.id,
         f.submitter_ref,
         o.name   AS organisation_name,
         f.page,
         ft.name  AS feedback_type_name,
         fs.name  AS feedback_status_name,
         f.promote,
         f.draft,
         f.gitlab_issue_iid,
         f.gitlab_issue_url,
         f.promoted_at,
         f.created_by,
         f.created_at,
         f.updated_by,
         f.updated_at
       FROM feedbacks f
       LEFT JOIN organisations   o  ON f.organisation   = o.id
       LEFT JOIN feedback_types  ft ON f.feedback_type   = ft.id
       LEFT JOIN feedback_status fs ON f.feedback_status = fs.id
       WHERE f.id = ?`
    )
    .get(feedbackId) as (Omit<FeedbackForGitLab, "promote" | "draft"> & { promote: number; draft: number }) | undefined;

  if (!row) return { feedback: null, thread: [] };

  const feedback: FeedbackForGitLab = {
    ...row,
    promote: Boolean(row.promote),
    draft:   Boolean(row.draft),
  };

  const thread = db
    .prepare(
      `SELECT id, author_role, message, created_by, created_at
       FROM feedback_messages
       WHERE feedback_id = ? AND soft_delete = 0
       ORDER BY created_at ASC, id ASC`
    )
    .all(feedbackId) as FeedbackMessageForGitLab[];

  return { feedback, thread };
}

export function persistGitLabIssueLink(
  feedbackId: number,
  iid: number,
  url: string | null
): void {
  db.prepare(
    `UPDATE feedbacks
     SET gitlab_issue_iid = ?,
         gitlab_issue_url = COALESCE(?, gitlab_issue_url),
         promoted_at = COALESCE(promoted_at, ?)
     WHERE id = ?`
  ).run(iid, url, new Date().toISOString(), feedbackId);
}

// ── Notification audit ────────────────────────────────────────────────────────

export function recordNotificationAudit(sessionId: string, recipients: string[]): void {
  if (recipients.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO notification_audit (session_id, user_email) VALUES (?, ?)`
  );
  const insertMany = db.transaction((rows: string[]) => {
    for (const email of rows) insert.run(sessionId, email);
  });
  insertMany(recipients);
}

export function getRecentlyNotified(
  recipients: string[],
  sessionIdPattern: string,
  cooldownHours: number
): Set<string> {
  if (recipients.length === 0) return new Set();
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
  const placeholders = recipients.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT LOWER(TRIM(user_email)) AS user_email
       FROM notification_audit
       WHERE LOWER(TRIM(user_email)) IN (${placeholders})
         AND session_id LIKE ?
         AND created_at > ?
       GROUP BY LOWER(TRIM(user_email))`
    )
    .all(...recipients.map((r) => r.toLowerCase()), sessionIdPattern, cutoff) as { user_email: string }[];
  return new Set(rows.map((r) => r.user_email));
}
