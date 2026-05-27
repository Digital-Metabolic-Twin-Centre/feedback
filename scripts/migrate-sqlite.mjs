#!/usr/bin/env node
/**
 * SQLite migration script for the feedback database.
 *
 * Usage:
 *   npm run migrate:sqlite           # create / migrate (non-destructive)
 *   npm run migrate:sqlite -- --seed # also (re-)seed reference data
 *   npm run migrate:sqlite -- --fresh # drop all tables, recreate, and seed
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { runSqliteMigrations, seedSqliteReferenceData } from "../lib/sqlite-migrations/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Resolve DB path from env or default
const DB_PATH = path.resolve(
  ROOT,
  process.env.SQLITE_PATH || "./data/feedback.db"
);

const args = process.argv.slice(2);
const FRESH = args.includes("--fresh");
const SEED = args.includes("--seed") || FRESH;

console.log(`\n  SQLite feedback database migration`);
console.log(`    Path  : ${DB_PATH}`);
console.log(`    Fresh : ${FRESH}`);
console.log(`    Seed  : ${SEED}\n`);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Drop all tables (--fresh only) should  not be run in production as it will result in data loss. Use with caution.
if (FRESH) {
  console.log("Dropping existing tables...");
  db.exec(`
    DROP TABLE IF EXISTS schema_migrations;
    DROP TABLE IF EXISTS notification_audit;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS feedback_messages;
    DROP TABLE IF EXISTS feedback;
    DROP TABLE IF EXISTS feedback_status;
    DROP TABLE IF EXISTS feedback_types;
    DROP TABLE IF EXISTS organisations;
    DROP TABLE IF EXISTS projects;
  `);
}

console.log("Applying migrations...");
runSqliteMigrations(db);
console.log("Migrations applied.");

// Seed reference data
if (SEED) {
  console.log("\n Seeding reference data...");
  seedSqliteReferenceData(db);
  console.log("Seed complete.");
}

db.close();
console.log("\n Migration finished.\n");
