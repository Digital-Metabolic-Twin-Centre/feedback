import { SelectQueryBuilder } from "@/lib/queries/types";

export const authAndNotificationsQuery: SelectQueryBuilder = {
  select: ({ tableName }) => {
    let sql = "";

    if (tableName === "auth_sessions") {
      sql = `
        SELECT id, user_id, event, session_id, ip_address, user_agent, timestamp
        FROM imdhub_logs.auth_sessions
        ORDER BY id DESC
      `;
    } else if (tableName === "no_group_notifications") {
      // no_group_notifications
      sql = `
        SELECT id, session_id, user_email, created_at
        FROM imdhub_logs.no_group_notifications
        ORDER BY id DESC
      `;
    } else {
      // download_activity_logs
      sql = `
        SELECT
          id,
          user_id,
          event_type,
          schema_name,
          table_name,
          page_path,
          file_type,
          row_count,
          clinical_site_breakdown,
          metadata,
          ip_address,
          user_agent,
          created_at
        FROM imdhub_logs.download_activity_logs
        ORDER BY id DESC
      `;
    }

    return { sql, params: [] };
  },
};
