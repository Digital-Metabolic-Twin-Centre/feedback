import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

describe("notification preference filtering", () => {
  const dbFile = path.resolve(process.cwd(), "data/feedback-notification-preferences-test.db");
  let db: Database.Database;
  let queries: typeof import("@/lib/feedback/sqlite-queries");

  function clearGlobalDbCache() {
    delete (globalThis as { feedbackDb?: Database.Database }).feedbackDb;
  }

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.SQLITE_PATH = "./data/feedback-notification-preferences-test.db";
    jest.resetModules();
    clearGlobalDbCache();
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }

    const dbModule = await import("@/lib/db-sqlite");
    queries = await import("@/lib/feedback/sqlite-queries");
    db = dbModule.feedbackDb;
  });

  afterEach(() => {
    db.close();
    clearGlobalDbCache();
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  });

  test("returns no recipients when feedback notifications are disabled site-wide", () => {
    db
      .prepare(`UPDATE notification_settings SET feedback_notifications_enabled = 0, updated_at = ? WHERE id = 1`)
      .run(new Date().toISOString());

    expect(
      queries.filterRecipientsWithFeedbackNotificationsEnabled(["alice@example.com", "bob@example.com"]),
    ).toEqual([]);
  });

  test("filters out recipients with disabled notification preferences", () => {
    const now = new Date().toISOString();

    db
      .prepare(`
        INSERT INTO notification_preferences (email, feedback_notifications_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      .run("bob@example.com", 0, now, now);

    expect(
      queries.filterRecipientsWithFeedbackNotificationsEnabled([
        "alice@example.com",
        "bob@example.com",
        "ALICE@example.com",
      ]),
    ).toEqual(["alice@example.com"]);
  });

  test("uses the assigned user email for internal notifications", () => {
    const now = new Date().toISOString();

    db
      .prepare(`
        INSERT INTO assigned_to (id, name, title, email, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(1, "Assigned Owner", "Support", "assigned@example.com", 0, now, now);

    db
      .prepare(`
        INSERT INTO assigned_to (id, name, title, email, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(2, "Default Owner", "Queue", "default@example.com", 1, now, now);

    db.prepare(`INSERT INTO feedback (email, assigned_to) VALUES (?, ?)`).run("user@example.com", 1);
    const feedbackId = db.prepare(`SELECT id FROM feedback ORDER BY id DESC LIMIT 1`).get() as { id: number };

    expect(queries.getInternalNotificationRecipientsForFeedback(feedbackId.id)).toEqual(["assigned@example.com"]);
  });

  test("falls back to the default user email when feedback is unassigned", () => {
    const now = new Date().toISOString();

    db
      .prepare(`
        INSERT INTO assigned_to (id, name, title, email, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(1, "Default Owner", "Queue", "default@example.com", 1, now, now);

    db.prepare(`INSERT INTO feedback (email, assigned_to) VALUES (?, NULL)`).run("user@example.com");
    const feedbackId = db.prepare(`SELECT id FROM feedback ORDER BY id DESC LIMIT 1`).get() as { id: number };

    expect(queries.getInternalNotificationRecipientsForFeedback(feedbackId.id)).toEqual(["default@example.com"]);
  });

  test("suppresses internal notifications when the assigned or default email is disabled", () => {
    const now = new Date().toISOString();

    db
      .prepare(`
        INSERT INTO assigned_to (id, name, title, email, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(1, "Default Owner", "Queue", "default@example.com", 1, now, now);

    db
      .prepare(`
        INSERT INTO notification_preferences (email, feedback_notifications_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      .run("default@example.com", 0, now, now);

    db.prepare(`INSERT INTO feedback (email, assigned_to) VALUES (?, NULL)`).run("user@example.com");
    const feedbackId = db.prepare(`SELECT id FROM feedback ORDER BY id DESC LIMIT 1`).get() as { id: number };
    const recipients = queries.getInternalNotificationRecipientsForFeedback(feedbackId.id);

    expect(queries.filterRecipientsWithFeedbackNotificationsEnabled(recipients)).toEqual([]);
  });
});
