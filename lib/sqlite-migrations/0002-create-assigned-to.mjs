const createAssignedToMigration = {
  id: "0002_create_assigned_to",
  description: "Create the assigned_to table for feedback assignees",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assigned_to (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        title      TEXT,
        email      TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_assigned_to_email ON assigned_to(email);
    `);
  },
};

export default createAssignedToMigration;
