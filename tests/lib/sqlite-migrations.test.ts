import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { runSqliteMigrations } from "@/lib/sqlite-migrations/index.mjs";

describe("SQLite migrations", () => {
  const dbFile = path.resolve(process.cwd(), "data/feedback-migrations-test.db");

  afterEach(() => {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  });

  test("adopts a legacy database into schema_migrations", () => {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });

    const db = new Database(dbFile);
    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE organisations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        label TEXT,
        country TEXT,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE feedback_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        label TEXT,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE feedback_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        label TEXT,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        submitter_ref TEXT,
        organisation INTEGER REFERENCES organisations(id),
        page TEXT,
        feedback_type INTEGER REFERENCES feedback_types(id),
        feedback_status INTEGER REFERENCES feedback_status(id),
        promote INTEGER NOT NULL DEFAULT 0,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        gitlab_issue_id INTEGER,
        gitlab_issue_url TEXT,
        promoted_at TEXT,
        created_by TEXT NOT NULL DEFAULT 'anonymous',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by TEXT NOT NULL DEFAULT 'anonymous',
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        is_admin INTEGER NOT NULL DEFAULT 0,
        draft INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE feedback_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
        author_role TEXT NOT NULL CHECK(author_role IN ('User', 'Admin')),
        message TEXT NOT NULL,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE notification_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    db.prepare(`INSERT INTO projects (slug, name) VALUES (?, ?)`).run("legacy", "Legacy Project");
    db.prepare(`INSERT INTO feedback (email) VALUES (?)`).run("legacy@example.com");

    runSqliteMigrations(db, { logger: null });

    const migrationIds = db
      .prepare("SELECT id FROM schema_migrations ORDER BY id ASC")
      .all() as Array<{ id: string }>;
    const feedbackColumns = db.prepare("PRAGMA table_info(feedback)").all() as Array<{ name: string }>;
    const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    const defaultProject = db
      .prepare("SELECT id FROM projects WHERE slug = ?")
      .get("default") as { id: number } | undefined;
    const legacyFeedback = db
      .prepare("SELECT project_id, github_issue_id, github_issue_url FROM feedback LIMIT 1")
      .get() as {
        project_id: number | null;
        github_issue_id: number | null;
        github_issue_url: string | null;
      };

    expect(migrationIds).toEqual([{ id: "0001_baseline" }]);
    expect(feedbackColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["project_id", "initial_message", "github_issue_id", "github_issue_url", "order"]),
    );
    expect(projectColumns.map((column) => column.name)).toContain("order");
    expect(defaultProject?.id).toBeGreaterThan(0);
    expect(legacyFeedback.project_id).toBe(defaultProject?.id);
    expect(legacyFeedback.github_issue_id).toBeNull();
    expect(legacyFeedback.github_issue_url).toBeNull();

    db.close();
  });
});
