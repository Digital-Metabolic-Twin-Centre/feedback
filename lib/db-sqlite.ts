import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env-validation";

const DB_PATH = path.resolve(process.cwd(), env.SQLITE_PATH);

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

    CREATE TABLE IF NOT EXISTS feedbacks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT    NOT NULL,
      submitter_ref   TEXT,
      clinical_site   INTEGER REFERENCES organisations(id),
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

    CREATE INDEX IF NOT EXISTS idx_feedbacks_email      ON feedbacks(email);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_soft_delete ON feedbacks(soft_delete);

    CREATE TABLE IF NOT EXISTS feedback_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
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
}
