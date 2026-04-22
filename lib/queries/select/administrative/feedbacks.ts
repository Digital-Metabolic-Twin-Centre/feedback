import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildFeedbacksQuery: SelectQueryBuilder = {
  select: ({ filters, groups }) => {
    let sql = `
      SELECT
        f.id,
        f.email,
        f.submitter_ref,
        f.clinical_site,
        cs.name AS clinical_site_name,
        f.page,
        f.feedback_type,
        ft.name AS feedback_type_name,
        f.feedback_status,
        fs.name AS feedback_status_name,
        f.promote,
        COALESCE(msg_count.thread_count, 0) AS thread_count,
        latest_msg.message AS latest_thread_message,
        latest_msg.author_role AS latest_thread_author_role,
        f.draft,
        f.soft_delete,
        f.created_by,
        f.created_at,
        f.updated_by,
        f.updated_at
      FROM imdhub_core.feedbacks AS f

      LEFT JOIN imdhub_refs.organisations cs
        ON f.clinical_site = cs.id

      LEFT JOIN imdhub_refs.feedback_types ft
        ON f.feedback_type = ft.id

      LEFT JOIN imdhub_refs.feedback_status fs
        ON f.feedback_status = fs.id

      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS thread_count
        FROM imdhub_core.feedback_messages fm
        WHERE fm.feedback_id = f.id
          AND COALESCE(fm.soft_delete, false) = false
      ) AS msg_count ON true

      LEFT JOIN LATERAL (
        SELECT
          fm.message,
          fm.author_role,
          fm.created_at
        FROM imdhub_core.feedback_messages fm
        WHERE fm.feedback_id = f.id
          AND COALESCE(fm.soft_delete, false) = false
        ORDER BY fm.created_at DESC, fm.id DESC
        LIMIT 1
      ) AS latest_msg ON true
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" && filters.draft === "false";

    if (isTrashed) {
      whereClauses.push(`f.soft_delete = true`);
    } else if (isDraft) {
      whereClauses.push(`f.draft = true`);
    } else if (isActive) {
      whereClauses.push(`
        (COALESCE(f.soft_delete,false) = false)
        AND (COALESCE(f.draft,false) = false)
      `);
    }

    // group filter (by clinical site)
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (
      filters.__session_email &&
      !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)
    ) {
      whereClauses.push(`LOWER(TRIM(f.email)) = LOWER(TRIM($${params.length + 1}))`);
      params.push(filters.__session_email);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },

  count: ({ schema, groups, filters }) => {
    let sql = `
      SELECT COUNT(DISTINCT f.id) AS count
      FROM ${quoteIdent(schema)}.feedbacks f

      LEFT JOIN imdhub_refs.organisations cs
        ON f.clinical_site = cs.id

      WHERE 1=1
    `;

    const params: unknown[] = [];

    // group filter
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      sql += ` AND cs.name = ANY($${params.length + 1})`;
      params.push(groups);
    }

    if (
      filters.__session_email &&
      !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)
    ) {
      sql += ` AND LOWER(TRIM(f.email)) = LOWER(TRIM($${params.length + 1}))`;
      params.push(filters.__session_email);
    }

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" && filters.draft === "false";

    if (isTrashed) {
      sql += ` AND f.soft_delete = true`;
    } else if (isDraft) {
      sql += ` AND f.draft = true`;
    } else if (isActive) {
      sql += `
        AND (COALESCE(f.soft_delete,false) = false)
        AND (COALESCE(f.draft,false) = false)
      `;
    }

    return { sql, params };
  },
};
