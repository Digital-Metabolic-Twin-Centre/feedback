const createNotificationSettingsMigration = {
  id: "0004_create_notification_settings",
  description: "Create notification settings tables for global and per-email controls",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        feedback_notifications_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        feedback_notifications_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_email_unique_normalized
      ON notification_preferences(LOWER(TRIM(email)));
    `);

    db.prepare(`
      INSERT OR IGNORE INTO notification_settings (id, feedback_notifications_enabled)
      VALUES (1, 1)
    `).run();
  },
};

export default createNotificationSettingsMigration;
