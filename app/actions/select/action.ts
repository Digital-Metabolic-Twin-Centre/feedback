"use server";

import { pgPool } from "@/lib/db";
import {
  getUserFriendlyMessage,
  isSecurityCritical,
  logError,
} from "@/lib/error-logger";
import { selectFeedbacks } from "@/lib/feedback/sqlite-queries";
import { SELECT_QUERY_REGISTRY } from "@/lib/queries/select";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";

type DateFilter = {
  field: string;
  from?: string;
  to?: string;
};

type Pagination = {
  page: number;
  pageSize: number;
};

type SelectSuccess = {
  success: true;
  data: unknown[];
  meta?: { total: number };
};

type SelectFailure = {
  success: false;
  message: string;
};

type SelectResult = SelectSuccess | SelectFailure;

export async function getTableData(
  schema: string,
  tableName: string,
  filters: Record<string, string> = {},
  groups: string[] = [],
  dateFilter?: DateFilter,
  pagination?: Pagination,
): Promise<SelectResult> {
  if (tableName === "feedbacks") {
    try {
      const { data, total } = selectFeedbacks(filters, groups, pagination);
      return { success: true, data, meta: { total } };
    } catch (err) {
      return { success: false, message: getUserFriendlyMessage(err) };
    }
  }

  const client = await pgPool.connect();

  try {
    const builder = SELECT_QUERY_REGISTRY[tableName];

    if (!builder) {
      throw new Error(`No select query registered for table: ${tableName}`);
    }

    const built = builder.select({
      schema,
      tableName,
      filters,
      groups,
      dateFilter,
    });

    let sql = built.sql;
    const queryParams = [...built.params];
    let totalCount: number | undefined;

    if (pagination) {
      const { page, pageSize } = pagination;

      if (page < 1 || pageSize < 1) {
        throw new Error("Invalid pagination parameters");
      }

      if (builder.count) {
        const countBuilt = builder.count({
          schema,
          tableName,
          groups,
          filters,
          dateFilter,
        });
        const countResult = await client.query(countBuilt.sql, countBuilt.params);
        totalCount = Number(countResult.rows[0].count);
      } else {
        const countResult = await client.query(
          `SELECT COUNT(*) AS count FROM (${sql}) AS count_query`,
          queryParams,
        );
        totalCount = Number(countResult.rows[0].count);
      }

      const limit = pageSize;
      const offset = (page - 1) * pageSize;

      sql = `
        SELECT *
        FROM (${sql}) AS paged
        LIMIT $${queryParams.length + 1}
        OFFSET $${queryParams.length + 2}
      `;

      queryParams.push(limit, offset);

      const result = await client.query(sql, queryParams);
      return { success: true, data: result.rows, meta: { total: totalCount } };
    }

    const result = await client.query(sql, queryParams);
    return { success: true, data: result.rows };
  } catch (err: unknown) {
    const [userEmail] = await getUserEmailFromSession();
    const userId = userEmail || "imdhub-system";
    const severity = isSecurityCritical(err) ? "critical" : "error";

    logError(
      err,
      {
        operation: `Select:${tableName}`,
        userId,
        resource: `${schema}.${tableName}`,
        metadata: { filters, groups, dateFilter },
      },
      severity,
    );

    return { success: false, message: getUserFriendlyMessage(err) };
  } finally {
    client.release();
  }
}
