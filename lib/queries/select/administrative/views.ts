import { SelectQueryBuilder } from "@/lib/queries/types";

export const buildViewsQuery: SelectQueryBuilder = {
    select: ({ tableName, groups }) => {
        let sql = "";
        const params: unknown[] = [];

        if (
            tableName === "v_available_aliquots" ||
            tableName === "v_biospecimen_with_aliquots"
        ) {
            sql =
                tableName === "v_available_aliquots"
                    ? `
            SELECT *
            FROM imdhub_core.v_available_aliquots
          `
                    : `
            SELECT *
            FROM imdhub_core.v_biospecimen_with_aliquots
          `;

            if (groups.length > 0) {
                const placeholders = groups.map((_, i) => `$${i + 1}`).join(", ");
                sql += ` WHERE organisation_name IN (${placeholders})`;
                params.push(...groups);
            }

            sql += ` ORDER BY aliquot_identifier`;

            return { sql, params };
        }

        // v_ref_changelog
        sql = `
      SELECT id, operation, stamp, user_id, table_name
      FROM imdhub_logs.v_ref_changelog
      ORDER BY id DESC
    `;

        return { sql, params };
    },

    // THIS replaces the old getTableData if/else
    count: () => {
        // v_ref_changelog (no filters, no groups)
        return {
            sql: `
          SELECT COUNT(*) AS count
          FROM imdhub_logs.v_ref_changelog
        `,
            params: [],
        };
    },
};
