import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { cache } from "react";
import { pgPool } from "@/lib/db";

export type SystemSetting = {
  id: number;
  key: string;
  value: string;
  description: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  soft_delete: boolean | null;
};


export const systemSettingsQuery: SelectQueryBuilder = {
  select: ({ schema, filters }) => {
    let sql = `
      SELECT
        id,
        key,
        value,
        description,
        created_by,
        created_at,
        updated_by,
        updated_at,
        soft_delete
      FROM ${quoteIdent(schema)}.system_settings
    `;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isActive = filters.soft_delete === "false";

    if (isTrashed) {
      whereClauses.push(`soft_delete = true`);
    } else if (isActive) {
      whereClauses.push(`COALESCE(soft_delete,false) = false`);
    } // ALL, no filter

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    sql += ` ORDER BY key ASC`;

    return { sql, params };
  },

  count: ({ schema, filters }) => {
    let sql = `
      SELECT COUNT(*) AS count
      FROM ${quoteIdent(schema)}.system_settings
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isActive = filters.soft_delete === "false";

    if (isTrashed) {
      whereClauses.push(`soft_delete = true`);
    } else if (isActive) {
      whereClauses.push(`COALESCE(soft_delete,false) = false`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },
};

type SettingsFilters = {
  soft_delete?: "true" | "false";
};

/**
 * Executes systemSettingsQuery and returns a Map keyed by setting.key
 */
const fetchSystemSettings = cache(
  async (
    schema: string = "imdhub_logs",
    filters: SettingsFilters = { soft_delete: "false" }
  ): Promise<Map<string, SystemSetting>> => {
    const { sql, params } = systemSettingsQuery.select({
      schema,
      filters: filters as Record<string, string>,
      tableName: "system_settings",
      groups: []
    });

    const { rows } = await pgPool.query<SystemSetting>(sql, params);

    const map = new Map<string, SystemSetting>();
    for (const row of rows) {
      map.set(row.key, row);
    }

    return map;
  }
);


/**
 * Gets a specific system setting value by key
 * Returns null if the setting doesn't exist
 */
export async function getSystemSetting(
  key: string,
): Promise<string | null> {
  const settings = await fetchSystemSettings();
  const setting = settings.get(key);
  return setting?.value ?? null;
}

/**
 * Gets a specific system setting object by key
 * Returns null if the setting doesn't exist
 */
export async function getSystemSettingObject(
  key: string,
): Promise<SystemSetting | null> {
  const settings = await fetchSystemSettings();
  return settings.get(key) ?? null;
}

/**
 * Verifies if a system setting exists and is active
 */
export async function verifySystemSetting(
  key: string,
): Promise<boolean> {
  const settings = await fetchSystemSettings();
  return settings.has(key);
}

/**
 * Gets all system settings as a Map
 */
export async function getAllSystemSettings(
): Promise<Map<string, SystemSetting>> {
  return await fetchSystemSettings();
}

/**
 * Gets multiple system settings at once
 */
export async function getMultipleSystemSettings(
  keys: string[],
): Promise<Map<string, SystemSetting>> {
  const allSettings = await fetchSystemSettings();
  const result = new Map<string, SystemSetting>();

  keys.forEach(key => {
    const setting = allSettings.get(key);
    if (setting) {
      result.set(key, setting);
    }
  });

  return result;
}

