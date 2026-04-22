import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";

type QueryContext = {
  schema: string;
  groups?: string[];
  filters: Record<string, string | undefined>;
};

// Refactored to extract flag handling and where clause
// construction for better readability and maintainability
function extractFlags(filters: QueryContext["filters"]) {
  const {
    __mask_suspected_cases_genomics,
    __group_suspected_cases_genomics,
    __session_email,
    ...cleanFilters
  } = filters;

  return {
    maskSensitive: __mask_suspected_cases_genomics === "true",
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
    whereClauses.push(`uc.soft_delete = true`);
  } else if (isDraft) {
    whereClauses.push(`uc.draft = true`);
  } else if (isActive) {
    whereClauses.push(`
      (uc.soft_delete IS NULL OR uc.soft_delete = false)
      AND (uc.draft IS NULL OR uc.draft = false)
    `);
  }

  // Drafts are owner-visible only.
  // with a known session email: include non-drafts + own drafts
  // without a session email: hide all drafts defensively
  if (sessionEmail) {
    const sessionEmailPlaceholder = `$${params.length + 1}`;
    whereClauses.push(
      `(uc.draft IS NOT TRUE OR lower(coalesce(uc.updated_by, uc.created_by, '')) = ${sessionEmailPlaceholder})`,
    );
    params.push(sessionEmail);
  } else {
    whereClauses.push(`uc.draft IS NOT TRUE`);
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

export const buildSuspectedCasesQuery: SelectQueryBuilder = {
  select: ({ schema, groups = [], filters }: QueryContext) => {
    if (!schema) {
      throw new Error("buildSuspectedCasesQuery requires schema");
    }

    const {
      maskSensitive,
      groupCases,
      sessionEmail,
      filters: cleanFilters,
    } = extractFlags(filters);
    const params: unknown[] = [];
    const normalizedGroups = groups.map((g) =>
      g.trim().replace(/^\//, "").toLowerCase().replace(/\s+/g, "_"),
    );
    const normalizedClinicalSiteExpr =
      "lower(regexp_replace(trim(leading '/' from cs.name), '\\s+', '_', 'g'))";

    // Build can_edit column here
    let canEditRow = `false AS can_edit`;

    if (normalizedGroups.length > 0) {
      const placeholders = normalizedGroups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");

      canEditRow = `
      CASE
        WHEN ${normalizedClinicalSiteExpr} IN (${placeholders})
        THEN true
        ELSE false
      END AS can_edit
    `;

      params.push(...normalizedGroups);
    }

    let sql = `
      SELECT
        uc.*,
        ${canEditRow},
        ${maskSensitive ? "'********'" : "uc.email"} AS email,
        ${maskSensitive ? "'********'" : "uc.updated_by"} AS updated_by,
        ${maskSensitive ? "'********'" : "uc.created_by"} AS created_by,
        ${maskSensitive ? "'********'" : "cs.name"} AS clinical_site_name,
        st.name AS types_of_samples_name
      FROM ${quoteIdent(schema)}.suspected_cases AS uc
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON uc.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.unsolved_samples_types AS st
        ON uc.types_of_samples = st.id
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
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    sql += `\nORDER BY uc.updated_at DESC`;

    return { sql, params };
  },

  count: ({ schema, groups = [], filters }: QueryContext) => {
    if (!schema) {
      throw new Error("buildSuspectedCasesQuery requires schema");
    }

    const { groupCases, sessionEmail, filters: cleanFilters } = extractFlags(filters);
    const normalizedGroups = groups.map((g) =>
      g.trim().replace(/^\//, "").toLowerCase().replace(/\s+/g, "_"),
    );
    const normalizedClinicalSiteExpr =
      "lower(regexp_replace(trim(leading '/' from cs.name), '\\s+', '_', 'g'))";

    let sql = `
      SELECT COUNT(*) AS count
      FROM ${quoteIdent(schema)}.suspected_cases AS uc
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON uc.clinical_site = cs.id
    `;

    const params: unknown[] = [];

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
