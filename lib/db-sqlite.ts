import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env-validation";
import { runSqliteMigrations } from "./sqlite-migrations/index.mjs";

const DB_PATH = path.resolve(process.cwd(), env.SQLITE_PATH || "./data/feedback.db");

// Ensure the directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const globalForSqlite = globalThis as unknown as { feedbackDb?: Database.Database };

export const feedbackDb: Database.Database =
  globalForSqlite.feedbackDb ??
  new Database(DB_PATH, { verbose: process.env.NODE_ENV === "development" ? undefined : undefined });

if (!globalForSqlite.feedbackDb) {
  globalForSqlite.feedbackDb = feedbackDb;

  // WAL mode for better concurrent read performance
  feedbackDb.pragma("journal_mode = WAL");
  feedbackDb.pragma("foreign_keys = ON");

  runSqliteMigrations(feedbackDb, {
    logger: process.env.NODE_ENV === "development" ? console : null,
  });
}
