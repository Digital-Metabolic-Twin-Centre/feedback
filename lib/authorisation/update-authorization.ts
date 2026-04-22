"use server";

/**
 * Update Authorization Module
 * 
 * Handles authorization for update operations.
 * Enforces both permission-based and clinical site-based access control.
 */

import { pgPool } from "@/lib/db";
import { SITE_PERMISSIONS, ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { TABLE_RELATIONSHIPS, BYPASS_CLINICAL_SITE_CHECK, NO_ACTION_PERMITTED, type BypassTable, type NoActionTable } from "@/lib/authorisation/constants";

export type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; reason: string };

interface AuthContext {
  email: string;
  roles: string[];
  groups: string[];
}



/**
 * Get authentication context from server session
 */
async function getAuthContext(): Promise<AuthContext | null> {
  const [email] = await getUserEmailFromSession();
  if (!email) return null;

  const { roles, groups } = await getUserGroupsFromSession();

  return {
    email,
    roles: Array.isArray(roles) ? roles : [],
    groups: Array.isArray(groups) ? groups : [],
  };
}

/**
 * Normalize group name for comparison
 */
function normalizeGroupName(name: string): string {
  return name
    .trim()
    .replace(/^\//, "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getComparableGroupNames(groups: string[]): string[] {
  const unique = new Set<string>();
  for (const group of groups) {
    const trimmed = group.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
    unique.add(trimmed.replace(/^\//, ""));
  }
  return [...unique];
}

/**
 * Get the clinical_site ID for a given record by traversing relationships
 */
async function getClinicalSiteForRecord(
  schema: string,
  tableName: string,
  recordId: number | string
): Promise<number | null> {
  const client = await pgPool.connect();
  try {
    const relationship = TABLE_RELATIONSHIPS[tableName];

    // Table not in relationships mapping
    if (!relationship) return null;

    // Direct clinical_site column
    if (relationship.hasClinicalSite) {
      const { rows } = await client.query<{ clinical_site: number }>(
        `SELECT clinical_site FROM ${schema}.${tableName} WHERE id = $1`,
        [recordId]
      );
      return rows[0]?.clinical_site ?? null;
    }

    // Traverse relationships to find clinical_site
    if (relationship.findClinicalSiteVia) {
      let currentTable = tableName;
      let currentId: number | string = recordId;

      for (const join of relationship.findClinicalSiteVia) {
        const { rows } = await client.query<Record<string, unknown>>(
          `SELECT ${join.joinColumn} FROM ${schema}.${currentTable} WHERE id = $1`,
          [currentId]
        );

        if (!rows[0] || rows[0][join.joinColumn] == null) {
          return null;
        }

        currentId = rows[0][join.joinColumn] as number | string;
        currentTable = join.joinTable;

        // Check if we've reached a table with clinical_site
        const finalRelation = TABLE_RELATIONSHIPS[currentTable];
        if (finalRelation?.hasClinicalSite) {
          const { rows: siteRows } = await client.query<{ clinical_site: number }>(
            `SELECT clinical_site FROM ${schema}.${currentTable} WHERE id = $1`,
            [currentId]
          );
          return siteRows[0]?.clinical_site ?? null;
        }
      }
    }

    return null;
  } finally {
    client.release();
  }
}

/**
 * Get the clinical site name from its ID
 */
async function getClinicalSiteName(siteId: number): Promise<string | null> {
  const client = await pgPool.connect();
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM imdhub_refs.organisations WHERE id = $1`,
      [siteId]
    );
    return rows[0]?.name ?? null;
  } finally {
    client.release();
  }
}

/**
 * Check if a feedback record's status is "Closed"
 */
async function isFeedbackClosed(recordId: number | string): Promise<boolean> {
  const client = await pgPool.connect();
  try {
    const { rows } = await client.query<{ is_closed: boolean }>(
      `SELECT (fs.name = 'Closed') AS is_closed
       FROM imdhub_core.feedbacks f
       JOIN imdhub_refs.feedback_status fs ON f.feedback_status = fs.id
       WHERE f.id = $1`,
      [recordId]
    );
    return rows[0]?.is_closed ?? false;
  } finally {
    client.release();
  }
}

/**
 * Check if a feedback status id corresponds to the "Closed" status.
 */
async function isClosedFeedbackStatusId(statusId: number | string): Promise<boolean> {
  const client = await pgPool.connect();
  try {
    const { rows } = await client.query<{ is_closed: boolean }>(
      `
        SELECT (name = 'Closed') AS is_closed
        FROM imdhub_refs.feedback_status
        WHERE id = $1
      `,
      [statusId],
    );
    return rows[0]?.is_closed ?? false;
  } finally {
    client.release();
  }
}

async function canAccessSampleWithdrawalRecord(
  recordId: number | string,
  groups: string[],
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;

  const comparableGroups = getComparableGroupNames(groups);
  if (comparableGroups.length === 0) return false;

  const client = await pgPool.connect();
  try {
    const { rows } = await client.query<{ allowed: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM imdhub_core.off_study os
          WHERE os.id = $1
            AND os.withdraw_samples IN (
              SELECT fus_filter.id
              FROM imdhub_refs.future_use_of_samples fus_filter
              WHERE COALESCE(fus_filter.soft_delete, false) = false
                AND (
                  LOWER(COALESCE(fus_filter.name, '')) = LOWER('Samples to be destroyed')
                  OR LOWER(COALESCE(fus_filter.label, '')) = LOWER('Samples to be destroyed')
                  OR LOWER(COALESCE(fus_filter.code, '')) IN (
                    'sample_destroyed',
                    'samples_destroyed',
                    'samples_to_be_destroyed'
                  )
                )
            )
            AND EXISTS (
              SELECT 1
              FROM imdhub_core.participant_visits pv2
              JOIN imdhub_core.biospecimen_logs bl2
                ON bl2.visit_id = pv2.id
                AND COALESCE(bl2.soft_delete, false) = false
                AND COALESCE(bl2.draft, false) = false
              JOIN imdhub_core.biospecimen_aliquots ba2
                ON ba2.biospecimen_log_id = bl2.id
              JOIN imdhub_core.shipment_items si2
                ON si2.biospecimen_aliquot_id = ba2.id
              JOIN imdhub_core.shipments s2
                ON s2.id = si2.shipment_id
                AND COALESCE(s2.soft_delete, false) = false
                AND COALESCE(s2.draft, false) = false
              JOIN imdhub_refs.shipment_destinations sd2
                ON sd2.id = s2.shipment_to
              WHERE pv2.participant_id = os.participant_id
                AND sd2.name = ANY($2::text[])
            )
        ) AS allowed;
      `,
      [recordId, comparableGroups],
    );

    return rows[0]?.allowed ?? false;
  } finally {
    client.release();
  }
}

/**
 * Check if user's groups allow access to the specified clinical site
 * Supports both name-based groups and ID-based groups (site_<id>)
 */
function userHasAccessToClinicalSite(
  userGroups: string[],
  clinicalSiteId: number,
  clinicalSiteName: string
): boolean {
  const normalizedGroups = userGroups.map(normalizeGroupName);

  // ID-based group check (preferred): site_<id> or just <id>
  const siteIdToken = `site_${clinicalSiteId}`;
  if (normalizedGroups.includes(siteIdToken)) return true;
  if (normalizedGroups.includes(String(clinicalSiteId))) return true;

  // Name-based group check (legacy)
  const siteNameToken = normalizeGroupName(clinicalSiteName);
  if (normalizedGroups.includes(siteNameToken)) return true;

  return false;
}

/**
 * Get the required permission for update operation on a specific table
 */
function getRequiredPermission(tableName: string): string | null {
  // Table-specific permissions
  const tablePermissions: Record<string, string> = {
    participant_registrations: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    participant_visits: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    biospecimen_logs: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    adverse_events: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    off_study: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    participant_data_queries: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    shipments: SITE_PERMISSIONS.CAN_UPDATE_ECRF,
    suspected_cases: SITE_PERMISSIONS.CAN_UPDATE_SUSPECTED_CASES,
  };

  if (tablePermissions[tableName]) {
    return tablePermissions[tableName];
  }

  // Unknown tables are denied by default.
  return null;
}

/**
 * Main authorization function for update operations
 * 
 * @param schema - Database schema
 * @param tableName - Table name
 * @param recordId - Record ID to authorize
 * @returns Authorization result
 */
export async function authorizeUpdateOperation(
  schema: string,
  tableName: string,
  recordId: number | string,
  updates?: Record<string, unknown>, // Optional updates for context-aware authorization
  source?: string
): Promise<AuthorizationResult> {

  // Get authentication context
  const ctx = await getAuthContext();

  if (!ctx) {
    return { authorized: false, reason: "Authentication required" };
  }

  // Deny deletion for certain critical tables regardless of permissions
  if (NO_ACTION_PERMITTED.includes(tableName as NoActionTable)) {
    return {
      authorized: false,
      reason: `Records deletion not permitted on this table.`,
    };
  }

  // Feedback records may only be edited by admins (ADMIN_GROUP_VIEW_PERMISSIONS group).
  // Closed feedback records are locked, except admins can reopen them by changing
  // feedback_status away from "Closed".
  if (tableName === "feedbacks") {
    const normalizedGroups = ctx.groups.map(normalizeGroupName);
    const isAdmin = normalizedGroups.includes(normalizeGroupName(ADMIN_GROUP_VIEW_PERMISSIONS));

    if (!isAdmin) {
      return {
        authorized: false,
        reason: "Only administrators can edit feedback records.",
      };
    }

    const feedbackId = recordId ?? (updates?.id as number | string | undefined);
    if (feedbackId !== undefined && feedbackId !== null) {
      const closed = await isFeedbackClosed(feedbackId);
      if (closed) {
        const nextStatusId = updates?.feedback_status as number | string | undefined;
        if (nextStatusId !== undefined && nextStatusId !== null) {
          const targetIsClosed = await isClosedFeedbackStatusId(nextStatusId);
          if (!targetIsClosed) {
            return { authorized: true };
          }
        }

        return {
          authorized: false,
          reason: "Closed feedback records can only be reopened by changing status.",
        };
      }
    }

    return { authorized: true };
  }

  // Check permission for update
  if (tableName === "off_study" && source === "labs_sample_withdrawal") {
    const canUpdateWithdrawal =
      ctx.roles.includes(SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB) ||
      ctx.roles.includes(SITE_PERMISSIONS.CAN_UPDATE_ECRF);

    if (!canUpdateWithdrawal) {
      return {
        authorized: false,
        reason: `You do not have permission to update ${tableName} records`,
      };
    }

    const normalizedGroups = ctx.groups.map(normalizeGroupName);
    const isAdmin = normalizedGroups.includes(
      normalizeGroupName(ADMIN_GROUP_VIEW_PERMISSIONS),
    );
    const canAccessRecord = await canAccessSampleWithdrawalRecord(
      recordId,
      ctx.groups,
      isAdmin,
    );

    if (!canAccessRecord) {
      return {
        authorized: false,
        reason: "You do not have permission to update this sample withdrawal record.",
      };
    }

    // Withdrawal flow uses shipment-destination scoping instead of clinical-site gating.
    return { authorized: true };
  }

  const requiredPermission = getRequiredPermission(tableName);

  if (!requiredPermission) {
    return {
      authorized: false,
      reason: `Update is not allowed for table "${tableName}"`,
    };
  }

  if (!ctx.roles.includes(requiredPermission)) {
    return {
      authorized: false,
      reason: `You do not have permission to update ${tableName} records`,
    };
  }

  // Skip clinical site check for certain tables
  if (schema === "imdhub_refs" || BYPASS_CLINICAL_SITE_CHECK.includes(tableName as BypassTable)) {
    return { authorized: true };
  }

  // Check clinical site access
  try {
    const clinicalSiteId = await getClinicalSiteForRecord(schema, tableName, recordId);

    // Table not in relationships or clinical site couldn't be resolved
    if (clinicalSiteId === null) {
      // If table is in relationships but clinical_site is null, deny for security
      if (TABLE_RELATIONSHIPS[tableName]) {
        return {
          authorized: false,
          reason: "Could not determine clinical site for this record. Access denied.",
        };
      }
      // Table not in relationships - allow
      return { authorized: true };
    }

    const siteName = await getClinicalSiteName(clinicalSiteId);

    if (!siteName) {
      return {
        authorized: false,
        reason: "Could not determine clinical site for this record",
      };
    }

    const hasAccess = userHasAccessToClinicalSite(
      ctx.groups,
      clinicalSiteId,
      siteName
    );

    const GENOMICS_FIELD = "committee_review";
    const updateKeys = Object.keys(updates ?? {});
    const isGenomicsFeedbackUpdate =
      tableName === "suspected_cases" &&
      updateKeys.includes(GENOMICS_FIELD);

    if (!hasAccess) {
      if (!isGenomicsFeedbackUpdate) {
        return {
          authorized: false,
          reason: `You can only update records from your clinical site. This record belongs to ${siteName}.`,
        };
      }

      if (!ctx.roles.includes(SITE_PERMISSIONS.CAN_SUBMIT_GENOMICS_FEEDBACK)) {
        return {
          authorized: false,
          reason: "You do not have permission to submit genomics feedback",
        };
      }
    }

    return { authorized: true };
  } catch (error) {
    console.error("[AUTH] Error checking update authorization:", error);
    return {
      authorized: false,
      reason: "Failed to verify authorization for this operation",
    };
  }
}

/**
 * Batch authorization for multiple update operations
 * 
 * @param schema - Database schema
 * @param tableName - Table name
 * @param recordIds - Array of record IDs to authorize
 * @returns Map of authorization results for each record
 */
export async function authorizeMultipleUpdates(
  schema: string,
  tableName: string,
  recordIds: (number | string)[]
): Promise<{
  authorized: Map<number | string, boolean>;
  deniedReasons: Map<number | string, string>;
}> {
  const authorized = new Map<number | string, boolean>();
  const deniedReasons = new Map<number | string, string>();

  await Promise.all(
    recordIds.map(async (id) => {
      const result = await authorizeUpdateOperation(schema, tableName, id);

      authorized.set(id, result.authorized);

      if (!result.authorized && 'reason' in result) {
        deniedReasons.set(id, result.reason);
      }
    })
  );

  return { authorized, deniedReasons };
}
