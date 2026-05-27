function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

const addAssignedToDefaultMigration = {
  id: "0006_add_assigned_to_default",
  description: "Add a default assignee flag to assigned_to",
  up(db) {
    if (!hasColumn(db, "assigned_to", "is_default")) {
      db.exec(`
        ALTER TABLE assigned_to
        ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0
      `);
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_assigned_to_single_default
      ON assigned_to(is_default)
      WHERE is_default = 1
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_assigned_to_single_default;
      ALTER TABLE assigned_to DROP COLUMN is_default;
    `);
  },
};

export default addAssignedToDefaultMigration;
