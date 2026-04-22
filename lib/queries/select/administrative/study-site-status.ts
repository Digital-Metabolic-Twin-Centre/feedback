import { SelectQueryBuilder } from "@/lib/queries/types";

export const buildStudySiteStatusQuery: SelectQueryBuilder = {
  select: ({ filters }) => {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    const isBackend = filters.studySiteQueryChoice === "backend";

    if (isBackend) {
      const isTrashed = filters?.soft_delete === "true";
      const isDraft = filters?.draft === "true";
      const isActive =
        filters?.soft_delete === "false" && filters?.draft === "false";

      if (isTrashed) {
        whereClauses.push(`soft_delete = true`);
      } else if (isDraft) {
        whereClauses.push(`draft = true`);
      } else if (isActive) {
        whereClauses.push(
          `COALESCE(soft_delete, false) = false AND COALESCE(draft, false) = false`,
        );
      }
    } else {
      // Frontend: NEVER show trashed
      whereClauses.push(`COALESCE(soft_delete, false) = false`);
    }

    let sql = `
      SELECT *
      FROM imdhub_refs.study_site_status
    `;

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    sql += isBackend
      ? ` ORDER BY updated_at ASC`
      : ` ORDER BY country_code ASC`;

    return { sql, params };
  },

  count: ({ filters }) => {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    const isBackend = filters.studySiteQueryChoice === "backend";

    if (isBackend) {
      const isTrashed = filters?.soft_delete === "true";
      const isDraft = filters?.draft === "true";
      const isActive =
        filters?.soft_delete === "false" && filters?.draft === "false";

      if (isTrashed) {
        whereClauses.push(`soft_delete = true`);
      } else if (isDraft) {
        whereClauses.push(`draft = true`);
      } else if (isActive) {
        whereClauses.push(
          `COALESCE(soft_delete, false) = false AND COALESCE(draft, false) = false`,
        );
      }
    } else {
      // Frontend count must match frontend select
      whereClauses.push(`COALESCE(soft_delete, false) = false`);
    }

    let sql = `
      SELECT COUNT(*) AS count
      FROM imdhub_refs.study_site_status
    `;

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    return { sql, params };
  },
};
