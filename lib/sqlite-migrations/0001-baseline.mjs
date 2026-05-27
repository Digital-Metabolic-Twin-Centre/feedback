function ensureColumn(db, tableName, columnName, definition, backfillSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }

  if (backfillSql) {
    db.exec(backfillSql);
  }
}

function ensureOrderColumn(db, tableName) {
  ensureColumn(
    db,
    tableName,
    "order",
    `"order" INTEGER NOT NULL DEFAULT 0`,
    `UPDATE ${tableName} SET "order" = id WHERE "order" = 0`
  );
}

function ensureFeedbackCompatibility(db) {
  ensureColumn(
    db,
    "feedback",
    "project_id",
    `project_id INTEGER REFERENCES projects(id)`
  );
  ensureColumn(db, "feedback", "initial_message", "initial_message TEXT");
  ensureColumn(db, "feedback", "github_issue_id", "github_issue_id INTEGER");
  ensureColumn(db, "feedback", "github_issue_url", "github_issue_url TEXT");
}

function ensureDefaultProject(db) {
  db.prepare(`INSERT OR IGNORE INTO projects (slug, name) VALUES (?, ?)`)
    .run("default", "Default Project");

  const defaultProject = db
    .prepare(`SELECT id FROM projects WHERE LOWER(TRIM(slug)) = LOWER(TRIM(?)) LIMIT 1`)
    .get("default");

  if (!defaultProject?.id) {
    throw new Error("Failed to ensure the default project exists.");
  }

  db.prepare(`UPDATE feedback SET project_id = ? WHERE project_id IS NULL`).run(defaultProject.id);
}

const baselineMigration = {
  id: "0001_baseline",
  description: "Establish tracked baseline schema for the feedback database",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        slug        TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        "order"     INTEGER NOT NULL DEFAULT 0,
        draft       INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS organisations (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        label       TEXT,
        country     TEXT,
        "order"     INTEGER NOT NULL DEFAULT 0,
        draft       INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by  TEXT,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS feedback_types (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        label       TEXT,
        "order"     INTEGER NOT NULL DEFAULT 0,
        draft       INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by  TEXT,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS feedback_status (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        label       TEXT,
        "order"     INTEGER NOT NULL DEFAULT 0,
        draft       INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by  TEXT,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id       INTEGER REFERENCES projects(id),
        email            TEXT NOT NULL,
        submitter_ref    TEXT,
        organisation     INTEGER REFERENCES organisations(id),
        page             TEXT,
        initial_message  TEXT,
        feedback_type    INTEGER REFERENCES feedback_types(id),
        feedback_status  INTEGER REFERENCES feedback_status(id),
        "order"          INTEGER NOT NULL DEFAULT 0,
        promote          INTEGER NOT NULL DEFAULT 0,
        draft            INTEGER NOT NULL DEFAULT 0,
        soft_delete      INTEGER NOT NULL DEFAULT 0,
        gitlab_issue_id  INTEGER,
        gitlab_issue_url TEXT,
        github_issue_id  INTEGER,
        github_issue_url TEXT,
        promoted_at      TEXT,
        created_by       TEXT NOT NULL DEFAULT 'anonymous',
        created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by       TEXT NOT NULL DEFAULT 'anonymous',
        updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        key_prefix   TEXT NOT NULL,
        key_hash     TEXT NOT NULL UNIQUE,
        "order"      INTEGER NOT NULL DEFAULT 0,
        is_admin     INTEGER NOT NULL DEFAULT 0,
        draft        INTEGER NOT NULL DEFAULT 0,
        soft_delete  INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS feedback_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
        author_role TEXT NOT NULL CHECK(author_role IN ('User', 'Admin')),
        message     TEXT NOT NULL,
        "order"     INTEGER NOT NULL DEFAULT 0,
        soft_delete INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_by  TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS notification_audit (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        "order"    INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
    `);

    ensureFeedbackCompatibility(db);

    ensureOrderColumn(db, "projects");
    ensureOrderColumn(db, "organisations");
    ensureOrderColumn(db, "feedback_types");
    ensureOrderColumn(db, "feedback_status");
    ensureOrderColumn(db, "feedback");
    ensureOrderColumn(db, "api_keys");
    ensureOrderColumn(db, "feedback_messages");
    ensureOrderColumn(db, "notification_audit");

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feedback_email ON feedback(email);
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_soft_delete ON feedback(soft_delete);
      CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON feedback(project_id);

      CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

      CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at ON feedback_messages(created_at);

      CREATE INDEX IF NOT EXISTS idx_notification_audit_session_id ON notification_audit(session_id);
      CREATE INDEX IF NOT EXISTS idx_notification_audit_created_at ON notification_audit(created_at);
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_unique_normalized
      ON projects(LOWER(TRIM(slug)));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name_unique_normalized
      ON projects(LOWER(TRIM(name)));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_types_name_unique_normalized
      ON feedback_types(LOWER(TRIM(name)));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_status_name_unique_normalized
      ON feedback_status(LOWER(TRIM(name)));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_name_unique_normalized
      ON organisations(LOWER(TRIM(name)));

      CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_name_unique_active_normalized
      ON api_keys(LOWER(TRIM(name)))
      WHERE soft_delete = 0;
    `);

    ensureDefaultProject(db);
  },
};

export default baselineMigration;
