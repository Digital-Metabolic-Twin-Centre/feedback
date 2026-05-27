import baselineMigration from "./0001-baseline.mjs";
import createAssignedToMigration from "./0002-create-assigned-to.mjs";
import addFeedbackAssignedToMigration from "./0003-add-feedback-assigned-to.mjs";

const migrations = [
  baselineMigration,
  createAssignedToMigration,
  addFeedbackAssignedToMigration,
];

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
}

export function runSqliteMigrations(db, options = {}) {
  const logger = options.logger ?? console;

  ensureMigrationsTable(db);

  const applied = new Set(
    db.prepare(`SELECT id FROM schema_migrations ORDER BY id ASC`).all().map((row) => row.id)
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    logger?.log?.(`Applying migration ${migration.id}: ${migration.description}`);

    db.transaction(() => {
      migration.up(db);
      db.prepare(`
        INSERT INTO schema_migrations (id, description)
        VALUES (?, ?)
      `).run(migration.id, migration.description);
    })();
  }

  return db
    .prepare(`SELECT id, description, applied_at FROM schema_migrations ORDER BY id ASC`)
    .all();
}

export function seedSqliteReferenceData(db, options = {}) {
  const logger = options.logger ?? console;

  db.transaction(() => {
    const insertType = db.prepare(`
      INSERT INTO feedback_types (name, label) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET label = excluded.label
    `);
    const feedbackTypes = [
      ["Bug Report", "Bug Report"],
      ["Feature Request", "Feature Request"],
      ["General Feedback", "General Feedback"],
      ["Improvement Suggestion", "Improvement Suggestion"],
      ["Data Quality Issue", "Data Quality Issue"],
      ["Other", "Other"],
    ];
    for (const [name, label] of feedbackTypes) {
      insertType.run(name, label);
    }
    logger?.log?.(`   feedback_types   -> ${feedbackTypes.length} rows`);

    const insertStatus = db.prepare(`
      INSERT INTO feedback_status (name, label) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET label = excluded.label
    `);
    const statuses = [
      ["Open", "Open"],
      ["In Progress", "In Progress"],
      ["Pending Review", "Pending Review"],
      ["Resolved", "Resolved"],
      ["Closed", "Closed"],
      ["Won't Fix", "Won't Fix"],
    ];
    for (const [name, label] of statuses) {
      insertStatus.run(name, label);
    }
    logger?.log?.(`   feedback_status  -> ${statuses.length} rows`);

    const insertOrg = db.prepare(`
      INSERT INTO organisations (name, label, country) VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING
    `);
    const orgs = [
      ["General", "General / Other", null],
      ["Heidelberg University", "Heidelberg University", "Germany"],
      ["Erasmus MC", "Erasmus Medical Centre", "Netherlands"],
      ["Birmingham Children's", "Birmingham Children's Hospital", "United Kingdom"],
    ];
    for (const [name, label, country] of orgs) {
      insertOrg.run(name, label, country);
    }
    logger?.log?.(`   organisations    -> ${orgs.length} rows`);
  })();
}
