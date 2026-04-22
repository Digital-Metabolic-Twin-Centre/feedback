"use server";

import { getTableData } from "@/app/actions/select/action";

/**
 * Fetch reference/lookup data for a single table.
 * Used by /api/select/multiple to resolve foreign-key dropdowns
 * in a single round-trip per table.
 */
export async function getForeignTableData(
  schema: string,
  table: string,
  groups: string[],
  filters: Record<string, string> = {},
) {
  return getTableData(schema, table, filters, groups);
}
