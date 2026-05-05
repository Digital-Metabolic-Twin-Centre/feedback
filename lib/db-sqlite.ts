import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env-validation";

const DB_PATH = path.resolve(process.cwd(), env.SQLITE_PATH || "./data/feedback.db");

// Ensure the directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const globalForSqlite = globalThis as unknown as { feedbackDb?: Database.Database };

export const feedbackDb: Database.Database =
  globalForSqlite.feedbackDb ??
  new Database(DB_PATH, { verbose: process.env.NODE_ENV === "development" ? undefined : undefined });

if (!globalForSqlite.feedbackDb) {
  globalForSqlite.feedbackDb = feedbackDb;

  // WAL mode for better concurrent read performance
  feedbackDb.pragma("journal_mode = WAL");
  feedbackDb.pragma("foreign_keys = ON");

  applySchema(feedbackDb);
}

function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      slug      TEXT NOT NULL UNIQUE,
      name      TEXT NOT NULL,
      draft     INTEGER NOT NULL DEFAULT 0,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS organisations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      label     TEXT,
      country   TEXT,
      draft     INTEGER NOT NULL DEFAULT 0,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS feedback_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      label      TEXT,
      draft      INTEGER NOT NULL DEFAULT 0,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS feedback_status (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      label      TEXT,
      draft      INTEGER NOT NULL DEFAULT 0,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id      INTEGER REFERENCES projects(id),
      email           TEXT    NOT NULL,
      submitter_ref   TEXT,
      organisation   INTEGER REFERENCES organisations(id),
      page            TEXT,
      feedback_type   INTEGER REFERENCES feedback_types(id),
      feedback_status INTEGER REFERENCES feedback_status(id),
      promote         INTEGER NOT NULL DEFAULT 0,
      draft           INTEGER NOT NULL DEFAULT 0,
      soft_delete     INTEGER NOT NULL DEFAULT 0,
      gitlab_issue_iid INTEGER,
      gitlab_issue_url TEXT,
      promoted_at      TEXT,
      created_by      TEXT    NOT NULL DEFAULT 'anonymous',
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by      TEXT    NOT NULL DEFAULT 'anonymous',
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_email      ON feedback(email);
    CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_soft_delete ON feedback(soft_delete);

    CREATE TABLE IF NOT EXISTS api_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      key_prefix  TEXT NOT NULL,
      key_hash    TEXT NOT NULL UNIQUE,
      is_admin    INTEGER NOT NULL DEFAULT 0,
      draft       INTEGER NOT NULL DEFAULT 0,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

    CREATE TABLE IF NOT EXISTS feedback_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      author_role TEXT NOT NULL CHECK(author_role IN ('User', 'Admin')),
      message     TEXT NOT NULL,
      soft_delete INTEGER NOT NULL DEFAULT 0,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_by  TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at  ON feedback_messages(created_at);

    CREATE TABLE IF NOT EXISTS notification_audit (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL,
      user_email TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notification_audit_session_id ON notification_audit(session_id);
    CREATE INDEX IF NOT EXISTS idx_notification_audit_created_at ON notification_audit(created_at);
  `);

  const feedbackColumns = db
    .prepare(`PRAGMA table_info(feedback)`)
    .all() as Array<{ name: string }>;

  const hasProjectId = feedbackColumns.some((col) => col.name === "project_id");
  if (!hasProjectId) {
    db.exec(`ALTER TABLE feedback ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON feedback(project_id)`);

  const defaultProject = db
    .prepare(`SELECT id FROM projects WHERE slug = ? LIMIT 1`)
    .get("default") as { id: number } | undefined;

  let defaultProjectId = defaultProject?.id;
  if (!defaultProjectId) {
    const inserted = db
      .prepare(`INSERT INTO projects (slug, name) VALUES (?, ?) RETURNING id`)
      .get("default", "Default Project") as { id: number };
    defaultProjectId = inserted.id;
  }

  db.prepare(`UPDATE feedback SET project_id = ? WHERE project_id IS NULL`).run(defaultProjectId);
}
