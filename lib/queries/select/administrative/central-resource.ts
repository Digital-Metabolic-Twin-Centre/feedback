import { SelectQueryBuilder } from "@/lib/queries/types";

export const buildCentralResourceQuery: SelectQueryBuilder = {
  select: () => {
    const params: unknown[] = [];

    const sql = `
      SELECT id, drive_data, cache_refresh_time, updated_at FROM imdhub_core.google_drive_cache LIMIT 1
    `;

    return { sql, params };
  },
};
