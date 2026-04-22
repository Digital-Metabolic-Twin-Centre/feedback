import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

type QueryContext = {
  schema: string;
  groups?: string[];
  filters: Record<string, string | undefined>;
};

function extractFlags(filters: QueryContext["filters"]) {
  const {
    __group_suspected_cases_genomics,
    __session_email,
    ...cleanFilters
  } = filters;

  return {
    groupCases: __group_suspected_cases_genomics === "true",
    sessionEmail: __session_email?.trim().toLowerCase(),
    filters: cleanFilters,
  };
}

function buildWhereClause(
  filters: Record<string, string | undefined>,
  groups: string[],
  groupCases: boolean,
  params: unknown[],
  sessionEmail?: string,
  groupSqlExpression = "cs.name",
) {
  const whereClauses: string[] = [];
  const isTrashed = filters.soft_delete === "true";
  const isDraft = filters.draft === "true";
  const isActive = filters.soft_delete === "false" && filters.draft === "false";

  if (isTrashed) {
    whereClauses.push("uc.soft_delete = true");
  } else if (isDraft) {
    whereClauses.push("uc.draft = true");
  } else if (isActive) {
    whereClauses.push(`
      (uc.soft_delete IS NULL OR uc.soft_delete = false)
      AND (uc.draft IS NULL OR uc.draft = false)
    `);
  }

  if (sessionEmail) {
    const sessionEmailPlaceholder = `$${params.length + 1}`;
    whereClauses.push(
      `(uc.draft IS NOT TRUE OR lower(coalesce(uc.updated_by, uc.created_by, '')) = ${sessionEmailPlaceholder})`,
    );
    params.push(sessionEmail);
  } else {
    whereClauses.push("uc.draft IS NOT TRUE");
  }

  if (groups.length > 0 && groupCases) {
    const placeholders = groups
      .map((_, i) => `$${params.length + i + 1}`)
      .join(", ");
    whereClauses.push(`${groupSqlExpression} IN (${placeholders})`);
    params.push(...groups);
  }

  return whereClauses;
}

export const buildSuspectedCasesStatsQuery: SelectQueryBuilder = {
  select: ({ schema, groups = [], filters }: QueryContext) => {
    const { groupCases, sessionEmail, filters: cleanFilters } = extractFlags(filters);
    const params: unknown[] = [];
    const normalizedGroups = groups.map((g) =>
      g.trim().replace(/^\//, "").toLowerCase().replace(/\s+/g, "_"),
    );
    const normalizedClinicalSiteExpr =
      "lower(regexp_replace(trim(leading '/' from cs.name), '\\s+', '_', 'g'))";

    let sql = `
      SELECT
        COUNT(*)::int AS submitted_records_count,
        COUNT(DISTINCT uc.clinical_site)::int AS clinical_sites_count
      FROM ${quoteIdent(schema)}.suspected_cases AS uc
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON uc.clinical_site = cs.id
    `;

    const whereClauses = buildWhereClause(
      cleanFilters,
      normalizedGroups,
      groupCases,
      params,
      sessionEmail,
      normalizedClinicalSiteExpr,
    );

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },
};
