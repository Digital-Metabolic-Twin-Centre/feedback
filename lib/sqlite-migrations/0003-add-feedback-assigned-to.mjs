function ensureAssignedToColumn(db) {
  const columns = db.prepare(`PRAGMA table_info(feedback)`).all();
  const hasAssignedTo = columns.some((column) => column.name === "assigned_to");

  if (!hasAssignedTo) {
    db.exec(`
      ALTER TABLE feedback
      ADD COLUMN assigned_to INTEGER REFERENCES assigned_to(id)
    `);
  }
}

const addFeedbackAssignedToMigration = {
  id: "0003_add_feedback_assigned_to",
  description: "Add nullable feedback.assigned_to foreign key to assigned_to",
  up(db) {
    ensureAssignedToColumn(db);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON feedback(assigned_to);
    `);
  },
};

export default addFeedbackAssignedToMigration;
