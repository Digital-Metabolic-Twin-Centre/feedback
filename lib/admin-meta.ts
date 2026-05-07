import { z } from "zod";
import { assertApiKeyNameIsUnique, createApiKeyForProject, listApiKeys, revokeApiKeyById, type ApiKeySummary } from "@/lib/api-keys";
import { feedbackDb as db } from "@/lib/db-sqlite";
import { assertProjectUniqueness, createProject, listProjects, type ProjectSummary } from "@/lib/projects";

export const metaResourceSchema = z.enum([
  "feedback_status",
  "feedback_types",
  "organisations",
  "projects",
  "api_keys",
]);

export type MetaResource = z.infer<typeof metaResourceSchema>;

const booleanLike = z.union([z.boolean(), z.number().int().min(0).max(1)]).transform(Boolean);

const referencePayloadSchema = z.object({
  name: z.string().min(1).optional(),
  label: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
  draft: booleanLike.optional(),
  softDelete: booleanLike.optional(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

const projectPayloadSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  draft: booleanLike.optional(),
  softDelete: booleanLike.optional(),
});

const apiKeyCreatePayloadSchema = z.object({
  projectSlug: z.string().optional(),
  projectName: z.string().optional(),
  keyName: z.string().optional(),
  order: z.number().int().min(0).optional(),
  isAdmin: z.boolean().optional(),
});

const apiKeyUpdatePayloadSchema = z.object({
  name: z.string().min(1).optional(),
  projectId: z.number().int().positive().optional(),
  order: z.number().int().min(0).optional(),
  isAdmin: booleanLike.optional(),
  draft: booleanLike.optional(),
  softDelete: booleanLike.optional(),
});

type ReferenceSummary = {
  id: number;
  name: string;
  label: string | null;
  order: number;
  draft: boolean;
  softDelete: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  country?: string | null;
};

type ApiKeyDetail = ApiKeySummary & {
  order: number;
  draft: boolean;
  softDelete: boolean;
};

const referenceConfigs = {
  feedback_status: { table: "feedback_status", orderBy: "id ASC", hasCountry: false },
  feedback_types: { table: "feedback_types", orderBy: "id ASC", hasCountry: false },
  organisations: { table: "organisations", orderBy: "name ASC", hasCountry: true },
} as const satisfies Record<string, { table: string; orderBy: string; hasCountry: boolean }>;

function normalizedNameExists(
  resource: keyof typeof referenceConfigs,
  name: string,
  excludeId?: number
): boolean {
  const row = db
    .prepare(
      `SELECT id
       FROM ${referenceConfigs[resource].table}
       WHERE LOWER(TRIM(name)) = ?
         ${excludeId ? "AND id != ?" : ""}
       LIMIT 1`
    )
    .get(...(excludeId ? [name.trim().toLowerCase(), excludeId] : [name.trim().toLowerCase()])) as
    | { id: number }
    | undefined;

  return Boolean(row);
}

function assertReferenceNameIsUnique(
  resource: keyof typeof referenceConfigs,
  name: string,
  excludeId?: number
) {
  if (normalizedNameExists(resource, name, excludeId)) {
    throw new Error("Name already exists.");
  }
}

function normalizeProjectRow(row: {
  id: number;
  slug: string;
  name: string;
  order: number;
  draft: number;
  soft_delete: number;
  created_at: string;
  updated_at: string;
}): ProjectSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    order: row.order,
    draft: Boolean(row.draft),
    softDelete: Boolean(row.soft_delete),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listReferenceRows(resource: keyof typeof referenceConfigs, includeArchived: boolean): ReferenceSummary[] {
  const config = referenceConfigs[resource];
  const countrySelect = config.hasCountry ? ", country" : "";
  const where = includeArchived ? "" : "WHERE soft_delete = 0";
  const rows = db
    .prepare(
      `SELECT id, name, label, "order", draft, soft_delete, created_by, created_at, updated_by, updated_at${countrySelect}
       FROM ${config.table}
       ${where}
       ORDER BY "order" ASC, ${config.orderBy}`
    )
    .all() as Array<{
      id: number;
      name: string;
      label: string | null;
      order: number;
      draft: number;
      soft_delete: number;
      created_by: string | null;
      created_at: string;
      updated_by: string | null;
      updated_at: string;
      country?: string | null;
    }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    label: row.label,
    order: row.order,
    draft: Boolean(row.draft),
    softDelete: Boolean(row.soft_delete),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    ...(config.hasCountry ? { country: row.country ?? null } : {}),
  }));
}

function getReferenceRow(resource: keyof typeof referenceConfigs, id: number): ReferenceSummary | null {
  return listReferenceRows(resource, true).find((row) => row.id === id) ?? null;
}

function createReferenceRow(resource: keyof typeof referenceConfigs, payload: unknown): ReferenceSummary {
  const parsed = referencePayloadSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.name?.trim()) {
    throw new Error("Invalid request payload.");
  }

  const config = referenceConfigs[resource];
  const now = new Date().toISOString();
  const name = parsed.data.name.trim();
  assertReferenceNameIsUnique(resource, name);
  const label = parsed.data.label?.trim() || null;
  const country = config.hasCountry ? parsed.data.country?.trim() || null : null;
  const sortOrder = parsed.data.order ?? 0;
  const createdBy = parsed.data.createdBy?.trim() || null;
  const updatedBy = parsed.data.updatedBy?.trim() || createdBy;
  const countryColumns = config.hasCountry ? ", country" : "";
  const countryValues = config.hasCountry ? ", ?" : "";

  const row = db
    .prepare(
      `INSERT INTO ${config.table} (
         name, label, "order", draft, soft_delete, created_by, created_at, updated_by, updated_at${countryColumns}
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${countryValues})
       RETURNING id`
    )
    .get(
      name,
      label,
      sortOrder,
      parsed.data.draft ? 1 : 0,
      parsed.data.softDelete ? 1 : 0,
      createdBy,
      now,
      updatedBy,
      now,
      ...(config.hasCountry ? [country] : [])
    ) as { id: number };

  const created = getReferenceRow(resource, row.id);
  if (!created) {
    throw new Error("Failed to load created row.");
  }
  return created;
}

function updateReferenceRow(resource: keyof typeof referenceConfigs, id: number, payload: unknown): ReferenceSummary | null {
  const parsed = referencePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid request payload.");
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim();
    if (!name) throw new Error("Name cannot be empty.");
    assertReferenceNameIsUnique(resource, name, id);
    updates.push("name = ?");
    params.push(name);
  }
  if (parsed.data.label !== undefined) {
    updates.push("label = ?");
    params.push(parsed.data.label?.trim() || null);
  }
  if (parsed.data.order !== undefined) {
    updates.push(`"order" = ?`);
    params.push(parsed.data.order);
  }
  if (parsed.data.draft !== undefined) {
    updates.push("draft = ?");
    params.push(parsed.data.draft ? 1 : 0);
  }
  if (parsed.data.softDelete !== undefined) {
    updates.push("soft_delete = ?");
    params.push(parsed.data.softDelete ? 1 : 0);
  }
  if (parsed.data.createdBy !== undefined) {
    updates.push("created_by = ?");
    params.push(parsed.data.createdBy?.trim() || null);
  }
  if (parsed.data.updatedBy !== undefined) {
    updates.push("updated_by = ?");
    params.push(parsed.data.updatedBy?.trim() || null);
  }
  if (referenceConfigs[resource].hasCountry && parsed.data.country !== undefined) {
    updates.push("country = ?");
    params.push(parsed.data.country?.trim() || null);
  }

  if (!updates.length) {
    throw new Error("At least one updatable field is required.");
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString(), id);

  const result = db
    .prepare(`UPDATE ${referenceConfigs[resource].table} SET ${updates.join(", ")} WHERE id = ?`)
    .run(...params);

  if (result.changes < 1) {
    return null;
  }

  return getReferenceRow(resource, id);
}

function deleteReferenceRow(resource: keyof typeof referenceConfigs, id: number): boolean {
  const result = db
    .prepare(`UPDATE ${referenceConfigs[resource].table} SET soft_delete = 1, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);
  return result.changes > 0;
}

function getProjectById(id: number): ProjectSummary | null {
  const row = db
    .prepare(
      `SELECT id, slug, name, "order", draft, soft_delete, created_at, updated_at
       FROM projects
       WHERE id = ?
       LIMIT 1`
    )
    .get(id) as {
      id: number;
      slug: string;
      name: string;
      order: number;
      draft: number;
      soft_delete: number;
      created_at: string;
      updated_at: string;
    } | undefined;

  return row ? normalizeProjectRow(row) : null;
}

function updateProjectById(id: number, payload: unknown): ProjectSummary | null {
  const parsed = projectPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid request payload.");
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (parsed.data.slug !== undefined) {
    const slug = parsed.data.slug.trim().toLowerCase();
    if (!slug) throw new Error("Project slug cannot be empty.");
    assertProjectUniqueness({ slug, excludeId: id });
    updates.push("slug = ?");
    params.push(slug);
  }
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim();
    if (!name) throw new Error("Project name cannot be empty.");
    assertProjectUniqueness({ name, excludeId: id });
    updates.push("name = ?");
    params.push(name);
  }
  if (parsed.data.order !== undefined) {
    updates.push(`"order" = ?`);
    params.push(parsed.data.order);
  }
  if (parsed.data.draft !== undefined) {
    updates.push("draft = ?");
    params.push(parsed.data.draft ? 1 : 0);
  }
  if (parsed.data.softDelete !== undefined) {
    updates.push("soft_delete = ?");
    params.push(parsed.data.softDelete ? 1 : 0);
  }
  if (!updates.length) {
    throw new Error("At least one updatable field is required.");
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString(), id);

  const result = db
    .prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`)
    .run(...params);

  if (result.changes < 1) {
    return null;
  }

  return getProjectById(id);
}

function deleteProjectById(id: number): boolean {
  const result = db
    .prepare(`UPDATE projects SET soft_delete = 1, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);
  return result.changes > 0;
}

function getApiKeyById(id: number): ApiKeyDetail | null {
  const row = db
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
         k.draft,
         k.soft_delete,
         k.last_used_at,
         k.created_at,
         k.updated_at
       FROM api_keys k
       JOIN projects p ON p.id = k.project_id
       WHERE k.id = ?
       LIMIT 1`
    )
    .get(id) as {
      id: number;
      project_id: number;
      project_slug: string;
      project_name: string;
      name: string;
      order: number;
      key_prefix: string;
      is_admin: number;
      draft: number;
      soft_delete: number;
      last_used_at: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.project_id,
    projectSlug: row.project_slug,
    projectName: row.project_name,
    name: row.name,
    order: row.order,
    keyPrefix: row.key_prefix,
    isAdmin: Boolean(row.is_admin),
    revoked: Boolean(row.soft_delete),
    softDelete: Boolean(row.soft_delete),
    draft: Boolean(row.draft),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function updateApiKeyById(id: number, payload: unknown): ApiKeyDetail | null {
  const parsed = apiKeyUpdatePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid request payload.");
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim();
    if (!name) throw new Error("API key name cannot be empty.");
    assertApiKeyNameIsUnique(name, id);
    updates.push("name = ?");
    params.push(name);
  }
  if (parsed.data.projectId !== undefined) {
    updates.push("project_id = ?");
    params.push(parsed.data.projectId);
  }
  if (parsed.data.order !== undefined) {
    updates.push(`"order" = ?`);
    params.push(parsed.data.order);
  }
  if (parsed.data.isAdmin !== undefined) {
    updates.push("is_admin = ?");
    params.push(parsed.data.isAdmin ? 1 : 0);
  }
  if (parsed.data.draft !== undefined) {
    updates.push("draft = ?");
    params.push(parsed.data.draft ? 1 : 0);
  }
  if (parsed.data.softDelete !== undefined) {
    updates.push("soft_delete = ?");
    params.push(parsed.data.softDelete ? 1 : 0);
  }
  if (!updates.length) {
    throw new Error("At least one updatable field is required.");
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString(), id);

  const result = db
    .prepare(`UPDATE api_keys SET ${updates.join(", ")} WHERE id = ?`)
    .run(...params);

  if (result.changes < 1) {
    return null;
  }

  return getApiKeyById(id);
}

export function listMetaResource(resource: MetaResource, query: URLSearchParams) {
  switch (resource) {
    case "feedback_status":
    case "feedback_types":
    case "organisations":
      return listReferenceRows(resource, query.get("includeArchived") === "true");
    case "projects":
      return listProjects(query.get("includeArchived") === "true");
    case "api_keys":
      return listApiKeys({
        projectSlug: query.get("projectSlug") ?? undefined,
        includeRevoked: query.get("includeRevoked") === "true",
      });
  }
}

export function createMetaResource(resource: MetaResource, payload: unknown) {
  switch (resource) {
    case "feedback_status":
    case "feedback_types":
    case "organisations":
      return createReferenceRow(resource, payload);
    case "projects": {
      const parsed = projectPayloadSchema.safeParse(payload);
      if (!parsed.success || !parsed.data.name) {
        throw new Error("Invalid request payload.");
      }
      return createProject({ slug: parsed.data.slug, name: parsed.data.name, order: parsed.data.order });
    }
    case "api_keys": {
      const parsed = apiKeyCreatePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("Invalid request payload.");
      }
      return createApiKeyForProject({
        projectSlug: parsed.data.projectSlug,
        projectName: parsed.data.projectName,
        keyName: parsed.data.keyName,
        order: parsed.data.order,
        isAdmin: parsed.data.isAdmin,
      });
    }
  }
}

export function getMetaResourceById(resource: MetaResource, id: number) {
  switch (resource) {
    case "feedback_status":
    case "feedback_types":
    case "organisations":
      return getReferenceRow(resource, id);
    case "projects":
      return getProjectById(id);
    case "api_keys":
      return getApiKeyById(id);
  }
}

export function updateMetaResourceById(resource: MetaResource, id: number, payload: unknown) {
  switch (resource) {
    case "feedback_status":
    case "feedback_types":
    case "organisations":
      return updateReferenceRow(resource, id, payload);
    case "projects":
      return updateProjectById(id, payload);
    case "api_keys":
      return updateApiKeyById(id, payload);
  }
}

export function deleteMetaResourceById(resource: MetaResource, id: number): boolean {
  switch (resource) {
    case "feedback_status":
    case "feedback_types":
    case "organisations":
      return deleteReferenceRow(resource, id);
    case "projects":
      return deleteProjectById(id);
    case "api_keys":
      return revokeApiKeyById(id).success;
  }
}
