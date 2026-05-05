#!/usr/bin/env node
/**
 * SQLite migration script for the feedback database.
 *
 * Usage:
 *   npm run migrate:sqlite           # create / migrate (non-destructive)
 *   npm run migrate:sqlite -- --seed # also (re-)seed reference data
 *   npm run migrate:sqlite -- --fresh # drop all tables, recreate, and seed
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Resolve DB path from env or default
const DB_PATH = path.resolve(
  ROOT,
  process.env.SQLITE_PATH || "./data/feedback.db"
);

const args = process.argv.slice(2);
const FRESH = args.includes("--fresh");
const SEED = args.includes("--seed") || FRESH;

console.log(`\n📦  SQLite feedback database migration`);
console.log(`    Path  : ${DB_PATH}`);
console.log(`    Fresh : ${FRESH}`);
console.log(`    Seed  : ${SEED}\n`);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────────
// Drop all tables (--fresh only)
// ─────────────────────────────────────────────
if (FRESH) {
  console.log("🗑️   Dropping existing tables...");
  db.exec(`
    DROP TABLE IF EXISTS notification_audit;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS feedback_messages;
    DROP TABLE IF EXISTS feedback;
    DROP TABLE IF EXISTS feedback_status;
    DROP TABLE IF EXISTS feedback_types;
    DROP TABLE IF EXISTS organisations;
    DROP TABLE IF EXISTS projects;
  `);
}

// ─────────────────────────────────────────────
// Create tables
// ─────────────────────────────────────────────
console.log("🏗️   Applying schema...");

db.exec(`
  -- ── Projects ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    draft       INTEGER NOT NULL DEFAULT 0,
    soft_delete INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  -- ── Organisations ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS organisations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    label       TEXT,
    country     TEXT,
    draft       INTEGER NOT NULL DEFAULT 0,
    soft_delete INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_by  TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  -- ── Feedback types ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS feedback_types (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    label       TEXT,
    draft       INTEGER NOT NULL DEFAULT 0,
    soft_delete INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_by  TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  -- ── Feedback status ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS feedback_status (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    label       TEXT,
    draft       INTEGER NOT NULL DEFAULT 0,
    soft_delete INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_by  TEXT,
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  -- ── feedback ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS feedback (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id       INTEGER REFERENCES projects(id),
    email            TEXT    NOT NULL,
    submitter_ref    TEXT,
    organisation    INTEGER REFERENCES organisations(id),
    page             TEXT,
    feedback_type    INTEGER REFERENCES feedback_types(id),
    feedback_status  INTEGER REFERENCES feedback_status(id),
    promote          INTEGER NOT NULL DEFAULT 0,
    draft            INTEGER NOT NULL DEFAULT 0,
    soft_delete      INTEGER NOT NULL DEFAULT 0,
    gitlab_issue_iid INTEGER,
    gitlab_issue_url TEXT,
    promoted_at      TEXT,
    created_by       TEXT    NOT NULL DEFAULT 'anonymous',
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_by       TEXT    NOT NULL DEFAULT 'anonymous',
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_email       ON feedback(email);
  CREATE INDEX IF NOT EXISTS idx_feedback_created_at  ON feedback(created_at);
  CREATE INDEX IF NOT EXISTS idx_feedback_soft_delete ON feedback(soft_delete);

  -- ── API keys ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS api_keys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    key_prefix   TEXT    NOT NULL,
    key_hash     TEXT    NOT NULL UNIQUE,
    is_admin     INTEGER NOT NULL DEFAULT 0,
    draft        INTEGER NOT NULL DEFAULT 0,
    soft_delete  INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
  CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

  -- ── Feedback messages ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS feedback_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    author_role TEXT    NOT NULL CHECK(author_role IN ('User', 'Admin')),
    message     TEXT    NOT NULL,
    soft_delete INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_by  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at  ON feedback_messages(created_at);

  -- ── Notification audit ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS notification_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    user_email TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notification_audit_session_id ON notification_audit(session_id);
  CREATE INDEX IF NOT EXISTS idx_notification_audit_created_at ON notification_audit(created_at);
`);

console.log("✅  Schema applied.");

const feedbackColumns = db
  .prepare(`PRAGMA table_info(feedback)`)
  .all();

const hasProjectId = feedbackColumns.some((col) => col.name === "project_id");
if (!hasProjectId) {
  db.exec(`ALTER TABLE feedback ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON feedback(project_id)`);

const defaultProject = db
  .prepare(`
    INSERT INTO projects (slug, name) VALUES (?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
    RETURNING id
  `)
  .get("default", "Default Project");
db.prepare(`UPDATE feedback SET project_id = ? WHERE project_id IS NULL`).run(defaultProject.id);
console.log("✅  Ensured default project.");

// ─────────────────────────────────────────────
// Seed reference data
// ─────────────────────────────────────────────
if (SEED) {
  console.log("\n🌱  Seeding reference data...");

  const seedTx = db.transaction(() => {
    // Feedback types
    const insertType = db.prepare(`
      INSERT INTO feedback_types (name, label) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET label = excluded.label
    `);
    const feedbackTypes = [
      ["Bug Report",              "Bug Report"],
      ["Feature Request",         "Feature Request"],
      ["General Feedback",        "General Feedback"],
      ["Improvement Suggestion",  "Improvement Suggestion"],
      ["Data Quality Issue",      "Data Quality Issue"],
      ["Other",                   "Other"],
    ];
    for (const [name, label] of feedbackTypes) insertType.run(name, label);
    console.log(`   feedback_types   → ${feedbackTypes.length} rows`);

    // Feedback status
    const insertStatus = db.prepare(`
      INSERT INTO feedback_status (name, label) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET label = excluded.label
    `);
    const statuses = [
      ["Open",           "Open"],
      ["In Progress",    "In Progress"],
      ["Pending Review", "Pending Review"],
      ["Resolved",       "Resolved"],
      ["Closed",         "Closed"],
      ["Won't Fix",      "Won't Fix"],
    ];
    for (const [name, label] of statuses) insertStatus.run(name, label);
    console.log(`   feedback_status  → ${statuses.length} rows`);

    // Organisations (clinical sites)
    const insertOrg = db.prepare(`
      INSERT INTO organisations (name, label, country) VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING
    `);
    const orgs = [
      ["General",                    "General / Other",         null],
      ["Heidelberg University",      "Heidelberg University",   "Germany"],
      ["Erasmus MC",                 "Erasmus Medical Centre",  "Netherlands"],
      ["Birmingham Children's",      "Birmingham Children's Hospital", "United Kingdom"],
      ["Hôpital Necker",             "Hôpital Necker – Enfants Malades", "France"],
      ["Hospital La Fe",             "Hospital Universitari i Politècnic La Fe", "Spain"],
      ["Semmelweis University",      "Semmelweis University",   "Hungary"],
      ["Oslo University Hospital",   "Oslo University Hospital","Norway"],
    ];
    for (const [name, label, country] of orgs) insertOrg.run(name, label, country);
    console.log(`   organisations    → ${orgs.length} rows`);
  });

  seedTx();
  console.log("✅  Seed complete.");
}

db.close();
console.log("\n🎉  Migration finished.\n");
