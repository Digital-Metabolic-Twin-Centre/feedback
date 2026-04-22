import crypto from "crypto";
import { feedbackDb as db } from "@/lib/db-sqlite";

export type ApiKeyAuthContext = {
  keyId: number;
  projectId: number;
  projectSlug: string;
  projectName: string;
  isAdmin: boolean;
};

type ApiKeyRow = {
  id: number;
  project_id: number;
  project_slug: string;
  project_name: string;
  is_admin: number;
};

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || "default";
}

function getOrCreateProject(projectSlug: string, projectName?: string): { id: number; slug: string; name: string } {
  const slug = normalizeSlug(projectSlug || "default");
  const existing = db
    .prepare(`SELECT id, slug, name FROM projects WHERE slug = ? AND soft_delete = 0 LIMIT 1`)
    .get(slug) as { id: number; slug: string; name: string } | undefined;

  if (existing) {
    return existing;
  }

  const inserted = db
    .prepare(`INSERT INTO projects (slug, name) VALUES (?, ?) RETURNING id, slug, name`)
    .get(slug, projectName?.trim() || slug) as { id: number; slug: string; name: string };

  return inserted;
}

export function createApiKeyForProject(input?: {
  projectSlug?: string;
  projectName?: string;
  keyName?: string;
  isAdmin?: boolean;
}): {
  apiKey: string;
  keyPrefix: string;
  projectId: number;
  projectSlug: string;
  projectName: string;
  keyId: number;
  isAdmin: boolean;
} {
  const project = getOrCreateProject(input?.projectSlug || "default", input?.projectName);
  const apiKey = `fbk_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = apiKey.slice(0, 16);
  const keyHash = hashApiKey(apiKey);
  const now = new Date().toISOString();

  const row = db
    .prepare(
      `INSERT INTO api_keys (project_id, name, key_prefix, key_hash, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(
      project.id,
      input?.keyName?.trim() || "default-key",
      keyPrefix,
      keyHash,
      input?.isAdmin ? 1 : 0,
      now,
      now
    ) as { id: number };

  return {
    apiKey,
    keyPrefix,
    projectId: project.id,
    projectSlug: project.slug,
    projectName: project.name,
    keyId: row.id,
    isAdmin: Boolean(input?.isAdmin),
  };
}

export function validateApiKey(rawKey: string): ApiKeyAuthContext | null {
  const token = rawKey.trim();
  if (!token) return null;

  const keyHash = hashApiKey(token);
  const row = db
    .prepare(
      `SELECT
         k.id,
         k.project_id,
         p.slug AS project_slug,
         p.name AS project_name,
         k.is_admin
       FROM api_keys k
       JOIN projects p ON p.id = k.project_id
       WHERE k.key_hash = ?
         AND k.soft_delete = 0
         AND k.draft = 0
         AND p.soft_delete = 0
         AND p.draft = 0
       LIMIT 1`
    )
    .get(keyHash) as ApiKeyRow | undefined;

  if (!row) return null;

  db.prepare(`UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    new Date().toISOString(),
    row.id,
  );

  return {
    keyId: row.id,
    projectId: row.project_id,
    projectSlug: row.project_slug,
    projectName: row.project_name,
    isAdmin: Boolean(row.is_admin),
  };
}
