#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "lib", "sqlite-migrations");
const INDEX_FILE = path.join(MIGRATIONS_DIR, "index.mjs");

function toSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function resolveMigrationFile(rawName) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => /^\d{4}-.*\.mjs$/.test(fileName));

  if (rawName.endsWith(".mjs")) {
    return files.find((fileName) => fileName === rawName);
  }

  const slug = toSlug(rawName);
  return files.find((fileName) => fileName.replace(/^\d{4}-/, "").replace(/\.mjs$/, "") === slug);
}

function removeFromIndexFile(fileName) {
  const indexSource = fs.readFileSync(INDEX_FILE, "utf8");
  const importMatch = indexSource.match(new RegExp(`import\\s+(\\w+)\\s+from\\s+"\\./${fileName.replace(".", "\\.")}";`));

  if (!importMatch) {
    throw new Error(`Could not find import for ${fileName} in lib/sqlite-migrations/index.mjs`);
  }

  const identifier = importMatch[1];
  const withoutImport = indexSource.replace(`${importMatch[0]}\n`, "");
  const withoutEntry = withoutImport
    .replace(`  ${identifier},\n`, "")
    .replace(`,\n  ${identifier}\n`, "\n");

  if (withoutEntry === indexSource) {
    throw new Error(`Could not remove ${identifier} from lib/sqlite-migrations/index.mjs`);
  }

  fs.writeFileSync(INDEX_FILE, withoutEntry);
}

const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error("Usage: npm run migration:remove -- <migration-name-or-file>");
  process.exit(1);
}

const fileName = resolveMigrationFile(rawName);

if (!fileName) {
  console.error(`Migration not found: ${rawName}`);
  process.exit(1);
}

removeFromIndexFile(fileName);
fs.unlinkSync(path.join(MIGRATIONS_DIR, fileName));

console.log(`Removed migration: lib/sqlite-migrations/${fileName}`);
