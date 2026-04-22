import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { cache } from "react";
import { pgPool } from "@/lib/db";

export type AdminNotificationContact = {
  id: number;
  name: string;
  main_email_address: string | null;
  admin_notification: boolean | null;
  soft_delete: boolean | null;
};

export const buildContactsQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    const params: unknown[] = [];

    // Build can_edit column here
    let canEditRow = `false AS can_edit`;

    if (groups.length > 0) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");

      canEditRow = `
      CASE
        WHEN  org.name IN (${placeholders})
        THEN true
        ELSE false
      END AS can_edit
    `;

      params.push(...groups);
    }
    let sql = `
      SELECT
        c.*,
        ${canEditRow},
        org.name  AS organisation_name,
        cg.name   AS contact_group_name,
        cr.name   AS contact_role_name,
        jt.name   AS job_title_name,

        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT ca.affiliation),
          NULL
        ) AS affiliations
      FROM ${quoteIdent(schema)}.contacts AS c

      LEFT JOIN ${quoteIdent(schema)}.contact_affiliations AS ca
        ON ca.contact_id = c.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS org
        ON c.organisation_id = org.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.contact_groups AS cg
        ON c.contact_group_id = cg.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.contact_roles AS cr
        ON c.contact_role_id = cr.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.contact_job_titles AS jt
        ON c.job_title_id = jt.id
    `;

    const whereClauses: string[] = [];
    const isTrashed = filters.soft_delete === "true";
    const isActive = filters.soft_delete === "false";

    if (isTrashed) {
      whereClauses.push(`c.soft_delete = true`);
    } else if (isActive) {
      whereClauses.push(`(c.soft_delete IS NULL OR c.soft_delete = false)`);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n AND ");
    }

    sql += `
      GROUP BY
        c.id,
        org.name,
        cg.name,
        cr.name,
        jt.name
    `;

    sql += `\nORDER BY organisation_name ASC`;

    return { sql, params };
  },

  count: ({ schema, filters }) => {
    let sql = `
      SELECT COUNT(DISTINCT c.id) AS count
      FROM ${quoteIdent(schema)}.contacts c
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations org
        ON c.organisation_id = org.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isActive = filters.soft_delete === "false";

    if (isTrashed) {
      whereClauses.push(`c.soft_delete = true`);
    } else if (isActive) {
      whereClauses.push(`(c.soft_delete IS NULL OR c.soft_delete = false)`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },
};

/**
 * Executes buildContactsQuery and returns a Map keyed
 */
const fetchAdminNotificationContacts = cache(
  async (
    schema: string = "imdhub_core",
  ): Promise<AdminNotificationContact[]> => {
    const sql = `
      SELECT
        id,
        name,
        main_email_address,
        admin_notification,
        soft_delete
      FROM ${quoteIdent(schema)}.contacts
      WHERE admin_notification = true
        AND COALESCE(soft_delete,false) = false
        AND main_email_address IS NOT NULL
      ORDER BY name ASC
    `;

    const { rows } = await pgPool.query<AdminNotificationContact>(sql);

    return rows;
  },
);

/**
 * Fetches admin notification contacts for adverse events and returns their email addresses
 */
const fetchAdverseEventNotificationContacts = cache(
  async (
    ae_serious: boolean | null | undefined,
    participant_id: string,
    schema: string = "imdhub_core",
  ): Promise<AdminNotificationContact[]> => {
    const notificationColumn = ae_serious
      ? "sae_notification"
      : "ae_notification";

    const sql = `
          SELECT
            c.id,
            c.name,
            c.main_email_address,
            c.organisation_id,
            c.ae_notification,
            c.sae_notification,
            c.adverse_notification
          FROM ${quoteIdent(schema)}.contacts c
          INNER JOIN ${quoteIdent(schema)}.participant_registrations pr
            ON pr.id = $1
          WHERE
            (
              (
                c.organisation_id = pr.clinical_site
                AND c.${notificationColumn} = true
              )
              OR
              c.adverse_notification = true
            )
            AND COALESCE(c.soft_delete,false) = false
            AND c.main_email_address IS NOT NULL
          ORDER BY c.name ASC
    `;

    const { rows } = await pgPool.query<AdminNotificationContact>(sql, [
      participant_id,
    ]);

    return rows;
  },
);

/**
 *  Fetches admin notification contacts and returns their email addresses
 *  Only returns contacts that have admin_notification = true, are not soft deleted, and have a main_email_address
 */
export async function getAdminNotificationEmails(): Promise<string[]> {
  const contacts = await fetchAdminNotificationContacts();

  return contacts
    .map((c) => c.main_email_address)
    .filter((email): email is string => Boolean(email));
}

export async function getAdverseEventNotificationEmails(
  ae_serious: boolean | null | undefined,
  participant_id: string,
): Promise<string[]> {
  const contacts = await fetchAdverseEventNotificationContacts(
    ae_serious,
    participant_id,
  );

  return contacts
    .map((c) => c.main_email_address)
    .filter((email): email is string => Boolean(email));
}
