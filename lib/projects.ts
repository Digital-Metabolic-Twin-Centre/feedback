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

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function projectExistsBySlug(slug: string, excludeId?: number): boolean {
  const row = db
    .prepare(
      `SELECT id
       FROM projects
       WHERE LOWER(TRIM(slug)) = ?
         ${excludeId ? "AND id != ?" : ""}
       LIMIT 1`
    )
    .get(...(excludeId ? [slug, excludeId] : [slug])) as { id: number } | undefined;

  return Boolean(row);
}

function projectExistsByName(name: string, excludeId?: number): boolean {
  const row = db
    .prepare(
      `SELECT id
       FROM projects
       WHERE LOWER(TRIM(name)) = ?
         ${excludeId ? "AND id != ?" : ""}
       LIMIT 1`
    )
    .get(...(excludeId ? [name, excludeId] : [name])) as { id: number } | undefined;

  return Boolean(row);
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
  const name = input.name.trim();
  if (!slug) {
    throw new Error("Project slug cannot be empty.");
  }
  if (!name) {
    throw new Error("Project name cannot be empty.");
  }

  const now = new Date().toISOString();
  if (projectExistsBySlug(slug)) {
    throw new Error("Project slug already exists.");
  }
  if (projectExistsByName(normalizeName(name))) {
    throw new Error("Project name already exists.");
  }

  const row = db
    .prepare(
      `INSERT INTO projects (slug, name, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       RETURNING id, slug, name, draft, soft_delete, created_at, updated_at`
    )
    .get(slug, name, now, now) as {
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

export function assertProjectUniqueness(input: {
  slug?: string;
  name?: string;
  excludeId?: number;
}) {
  if (input.slug !== undefined) {
    const slug = normalizeSlug(input.slug);
    if (!slug) {
      throw new Error("Project slug cannot be empty.");
    }
    if (projectExistsBySlug(slug, input.excludeId)) {
      throw new Error("Project slug already exists.");
    }
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Project name cannot be empty.");
    }
    if (projectExistsByName(normalizeName(name), input.excludeId)) {
      throw new Error("Project name already exists.");
    }
  }
}
