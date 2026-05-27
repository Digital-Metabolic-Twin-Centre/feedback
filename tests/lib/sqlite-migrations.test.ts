import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { rollbackLastSqliteMigration, runSqliteMigrations } from "@/lib/sqlite-migrations/index.mjs";

describe("SQLite migrations", () => {
  const dbFile = path.resolve(process.cwd(), "data/feedback-migrations-test.db");
  const createMigrationScript = path.resolve(process.cwd(), "scripts/create-sqlite-migration.mjs");

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
    const assignedToColumns = db.prepare("PRAGMA table_info(assigned_to)").all() as Array<{
      name: string;
      notnull: number;
    }>;
    const notificationSettingsColumns = db.prepare("PRAGMA table_info(notification_settings)").all() as Array<{
      name: string;
    }>;
    const notificationPreferencesColumns = db.prepare("PRAGMA table_info(notification_preferences)").all() as Array<{
      name: string;
    }>;
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

    expect(migrationIds).toEqual([
      { id: "0001_baseline" },
      { id: "0002_create_assigned_to" },
      { id: "0003_add_feedback_assigned_to" },
      { id: "0004_create_notification_settings" },
      { id: "0005_add_notification_preference_indexes" },
      { id: "0006_add_assigned_to_default" },
    ]);
    expect(assignedToColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "name", notnull: 1 }),
        expect.objectContaining({ name: "title", notnull: 0 }),
        expect.objectContaining({ name: "email", notnull: 1 }),
        expect.objectContaining({ name: "is_default", notnull: 1 }),
      ]),
    );
    expect(feedbackColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "project_id",
        "initial_message",
        "github_issue_id",
        "github_issue_url",
        "assigned_to",
        "order",
      ]),
    );
    expect(projectColumns.map((column) => column.name)).toContain("order");
    expect(notificationSettingsColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "feedback_notifications_enabled", "updated_at"]),
    );
    expect(notificationPreferencesColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "email", "feedback_notifications_enabled", "created_at", "updated_at"]),
    );
    expect(defaultProject?.id).toBeGreaterThan(0);
    expect(legacyFeedback.project_id).toBe(defaultProject?.id);
    expect(legacyFeedback.github_issue_id).toBeNull();
    expect(legacyFeedback.github_issue_url).toBeNull();

    db.close();
  });

  test("rolls back one migration at a time", () => {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });

    const db = new Database(dbFile);
    runSqliteMigrations(db, { logger: null });

    expect(
      db.prepare("SELECT id FROM schema_migrations ORDER BY id ASC").all() as Array<{ id: string }>
    ).toEqual([
      { id: "0001_baseline" },
      { id: "0002_create_assigned_to" },
      { id: "0003_add_feedback_assigned_to" },
      { id: "0004_create_notification_settings" },
      { id: "0005_add_notification_preference_indexes" },
      { id: "0006_add_assigned_to_default" },
    ]);

    expect(rollbackLastSqliteMigration(db, { logger: null })).toBe("0006_add_assigned_to_default");
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(
        "idx_assigned_to_single_default",
      )
    ).toBeUndefined();
    expect(
      db.prepare("PRAGMA table_info(assigned_to)").all() as Array<{ name: string }>
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: "is_default" })]));
    expect(
      db.prepare("SELECT id FROM schema_migrations ORDER BY id ASC").all() as Array<{ id: string }>
    ).toEqual([
      { id: "0001_baseline" },
      { id: "0002_create_assigned_to" },
      { id: "0003_add_feedback_assigned_to" },
      { id: "0004_create_notification_settings" },
      { id: "0005_add_notification_preference_indexes" },
    ]);

    expect(rollbackLastSqliteMigration(db, { logger: null })).toBe("0005_add_notification_preference_indexes");
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(
        "idx_notification_preferences_enabled",
      )
    ).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM schema_migrations ORDER BY id ASC").all() as Array<{ id: string }>
    ).toEqual([
      { id: "0001_baseline" },
      { id: "0002_create_assigned_to" },
      { id: "0003_add_feedback_assigned_to" },
      { id: "0004_create_notification_settings" },
    ]);

    expect(rollbackLastSqliteMigration(db, { logger: null })).toBe("0004_create_notification_settings");
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(
        "notification_settings",
      )
    ).toBeUndefined();
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(
        "notification_preferences",
      )
    ).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM schema_migrations ORDER BY id ASC").all() as Array<{ id: string }>
    ).toEqual([
      { id: "0001_baseline" },
      { id: "0002_create_assigned_to" },
      { id: "0003_add_feedback_assigned_to" },
    ]);

    db.close();
  });

  test("migrate:create scaffolds both up and down functions", () => {
    const scriptSource = fs.readFileSync(createMigrationScript, "utf8");

    expect(scriptSource).toContain("up(db) {");
    expect(scriptSource).toContain("down(db) {");
    expect(scriptSource).toContain("-- Write your rollback here.");
  });
});
