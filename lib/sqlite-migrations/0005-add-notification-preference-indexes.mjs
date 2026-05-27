const addNotificationPreferenceIndexesMigration = {
  id: "0005_add_notification_preference_indexes",
  description: "Add lookup indexes for notification preference filtering",
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled
      ON notification_preferences(feedback_notifications_enabled);
    `);
  },
};

export default addNotificationPreferenceIndexesMigration;
