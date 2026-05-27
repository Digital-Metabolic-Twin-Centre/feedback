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

function toIdentifier(slug) {
  const base = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  if (!base) {
    return "GeneratedMigration";
  }

  return base.endsWith("Migration") ? base : `${base}Migration`;
}

function getNextMigrationNumber() {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  const numbers = files
    .map((fileName) => /^(\d{4})-.*\.mjs$/.exec(fileName))
    .filter(Boolean)
    .map((match) => Number(match[1]));

  const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return String(nextNumber).padStart(4, "0");
}

function updateIndexFile(fileName, identifier) {
  const importLine = `import ${identifier} from "./${fileName}";`;
  const indexSource = fs.readFileSync(INDEX_FILE, "utf8");

  if (indexSource.includes(importLine)) {
    return;
  }

  const withImport = indexSource.replace(
    "\n\nconst migrations = [",
    `\n${importLine}\n\nconst migrations = [`
  );

  const updated = withImport.replace(
    /const migrations = \[\n([\s\S]*?)\n\];/,
    (match, entries) => `const migrations = [\n${entries}\n  ${identifier},\n];`
  );

  if (updated === indexSource || updated === withImport) {
    throw new Error("Failed to update lib/sqlite-migrations/index.mjs");
  }

  fs.writeFileSync(INDEX_FILE, updated);
}

const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error("Usage: npm run migration:create -- <migration-name>");
  process.exit(1);
}

const slug = toSlug(rawName);

if (!slug) {
  console.error("Migration name must contain at least one letter or number.");
  process.exit(1);
}

const number = getNextMigrationNumber();
const fileName = `${number}-${slug}.mjs`;
const filePath = path.join(MIGRATIONS_DIR, fileName);
const identifier = toIdentifier(slug);
const migrationId = `${number}_${slug.replace(/-/g, "_")}`;

if (fs.existsSync(filePath)) {
  console.error(`Migration already exists: ${fileName}`);
  process.exit(1);
}

const fileContents = `const ${identifier} = {
  id: "${migrationId}",
  description: "${rawName}",
  up(db) {
    db.exec(\`
      -- Write your migration here.
    \`);
  },
};

export default ${identifier};
`;

fs.writeFileSync(filePath, fileContents);
updateIndexFile(fileName, identifier);

console.log(`Created migration: lib/sqlite-migrations/${fileName}`);
