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

export type ApiKeySummary = {
  id: number;
  projectId: number;
  projectSlug: string;
  projectName: string;
  name: string;
  order: number;
  keyPrefix: string;
  isAdmin: boolean;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function normalizeKeyName(value: string): string {
  return value.trim().toLowerCase();
}

function activeApiKeyNameExists(name: string, excludeId?: number): boolean {
  const row = db
    .prepare(
      `SELECT id
       FROM api_keys
       WHERE LOWER(TRIM(name)) = ?
         AND soft_delete = 0
         ${excludeId ? "AND id != ?" : ""}
       LIMIT 1`
    )
    .get(...(excludeId ? [normalizeKeyName(name), excludeId] : [normalizeKeyName(name)])) as
    | { id: number }
    | undefined;

  return Boolean(row);
}

export function assertApiKeyNameIsUnique(name: string, excludeId?: number) {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("API key name cannot be empty.");
  }

  if (activeApiKeyNameExists(normalized, excludeId)) {
    throw new Error("API key name already exists.");
  }
}

function getFirstActiveProject(): { id: number; slug: string; name: string } | null {
  const row = db
    .prepare(
      `SELECT id, slug, name
       FROM projects
       WHERE soft_delete = 0
       ORDER BY "order" ASC, id ASC
       LIMIT 1`
    )
    .get() as { id: number; slug: string; name: string } | undefined;

  return row ?? null;
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
  order?: number;
  isAdmin?: boolean;
}): {
  apiKey: string;
  keyPrefix: string;
  projectId: number;
  projectSlug: string;
  projectName: string;
  keyId: number;
  order: number;
  isAdmin: boolean;
} {
  const project =
    input?.projectSlug?.trim()
      ? getOrCreateProject(input.projectSlug, input?.projectName)
      : getFirstActiveProject() ?? getOrCreateProject("default", input?.projectName);
  const apiKey = `fbk_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = apiKey.slice(0, 16);
  const keyHash = hashApiKey(apiKey);
  const now = new Date().toISOString();
  const keyName = input?.keyName?.trim() || "default-key";
  const sortOrder = input?.order ?? 0;

  assertApiKeyNameIsUnique(keyName);

  const row = db
    .prepare(
      `INSERT INTO api_keys (project_id, name, "order", key_prefix, key_hash, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(
      project.id,
      keyName,
      sortOrder,
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
    order: sortOrder,
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

export function revokeApiKeyById(keyId: number): { success: boolean; rowCount: number } {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE api_keys
       SET soft_delete = 1, updated_at = ?
       WHERE id = ? AND soft_delete = 0`
    )
    .run(now, keyId);

  return { success: result.changes > 0, rowCount: result.changes };
}

export function rotateApiKeyById(keyId: number): {
  success: boolean;
  data?: {
    oldKeyId: number;
    newKeyId: number;
    apiKey: string;
    keyPrefix: string;
    projectId: number;
    projectSlug: string;
    projectName: string;
    isAdmin: boolean;
  };
  error?: string;
} {
  const existing = db
    .prepare(
      `SELECT
         k.id,
         k.project_id,
         k.name,
         k."order",
         k.is_admin,
         p.slug AS project_slug,
         p.name AS project_name
       FROM api_keys k
       JOIN projects p ON p.id = k.project_id
       WHERE k.id = ? AND k.soft_delete = 0
       LIMIT 1`
    )
    .get(keyId) as {
    id: number;
    project_id: number;
    name: string;
    order: number;
    is_admin: number;
    project_slug: string;
    project_name: string;
  } | undefined;

  if (!existing) {
    return { success: false, error: "API key not found or already revoked." };
  }

  const apiKey = `fbk_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = apiKey.slice(0, 16);
  const keyHash = hashApiKey(apiKey);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`UPDATE api_keys SET soft_delete = 1, updated_at = ? WHERE id = ?`).run(now, keyId);

    const inserted = db
      .prepare(
        `INSERT INTO api_keys (project_id, name, "order", key_prefix, key_hash, is_admin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(
        existing.project_id,
        existing.name,
        existing.order,
        keyPrefix,
        keyHash,
        existing.is_admin,
        now,
        now
      ) as { id: number };
    return inserted.id;
  });

  const newKeyId = tx();

  return {
    success: true,
    data: {
      oldKeyId: keyId,
      newKeyId,
      apiKey,
      keyPrefix,
      projectId: existing.project_id,
      projectSlug: existing.project_slug,
      projectName: existing.project_name,
      isAdmin: Boolean(existing.is_admin),
    },
  };
}

export function listApiKeys(filters?: {
  projectSlug?: string;
  includeRevoked?: boolean;
}): ApiKeySummary[] {
  const params: Array<string | number> = [];
  const where: string[] = ["p.soft_delete = 0"];

  if (filters?.projectSlug?.trim()) {
    where.push("p.slug = ?");
    params.push(filters.projectSlug.trim().toLowerCase());
  }

  if (!filters?.includeRevoked) {
    where.push("k.soft_delete = 0");
  }

  const rows = db
    .prepare(
      `SELECT
         k.id,
         k.project_id,
         p.slug AS project_slug,
         p.name AS project_name,
         k.name,
         k."order",
         k.key_prefix,
         k.is_admin,
         k.soft_delete,
         k.last_used_at,
         k.created_at,
         k.updated_at
       FROM api_keys k
       JOIN projects p ON p.id = k.project_id
       WHERE ${where.join(" AND ")}
       ORDER BY k."order" ASC, p.slug ASC, k.id DESC`
    )
    .all(...params) as Array<{
      id: number;
      project_id: number;
      project_slug: string;
      project_name: string;
      name: string;
      order: number;
      key_prefix: string;
      is_admin: number;
      soft_delete: number;
      last_used_at: string | null;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectSlug: row.project_slug,
    projectName: row.project_name,
    name: row.name,
    order: row.order,
    keyPrefix: row.key_prefix,
    isAdmin: Boolean(row.is_admin),
    revoked: Boolean(row.soft_delete),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
