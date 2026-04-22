import { feedbackDb as db } from "@/lib/db-sqlite";

export type ProjectSummary = {
  id: number;
  slug: string;
  name: string;
  draft: boolean;
  softDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function listProjects(includeArchived = false): ProjectSummary[] {
  const rows = db
    .prepare(
      `SELECT id, slug, name, draft, soft_delete, created_at, updated_at
       FROM projects
       ${includeArchived ? "" : "WHERE soft_delete = 0"}
       ORDER BY slug ASC`
    )
    .all() as Array<{
    id: number;
    slug: string;
    name: string;
    draft: number;
    soft_delete: number;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    draft: Boolean(row.draft),
    softDelete: Boolean(row.soft_delete),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function createProject(input: { slug: string; name: string }): ProjectSummary {
  const slug = normalizeSlug(input.slug);
  if (!slug) {
    throw new Error("Project slug cannot be empty.");
  }

  const now = new Date().toISOString();
  const existing = db
    .prepare(`SELECT id FROM projects WHERE slug = ? LIMIT 1`)
    .get(slug) as { id: number } | undefined;

  if (existing) {
    throw new Error("Project slug already exists.");
  }

  const row = db
    .prepare(
      `INSERT INTO projects (slug, name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       RETURNING id, slug, name, draft, soft_delete, created_at, updated_at`
    )
    .get(slug, input.name.trim(), now, now) as {
    id: number;
    slug: string;
    name: string;
    draft: number;
    soft_delete: number;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    draft: Boolean(row.draft),
    softDelete: Boolean(row.soft_delete),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
