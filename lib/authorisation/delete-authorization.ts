"use server";

/**
 * Delete Authorization Module
 * 
 * Handles authorization for delete, trash, and restore operations.
 * Enforces both permission-based and clinical site-based access control.
 */

import { pgPool } from "@/lib/db";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { TABLE_RELATIONSHIPS, BYPASS_CLINICAL_SITE_CHECK, NO_ACTION_PERMITTED, type BypassTable, type NoActionTable } from "@/lib/authorisation/constants";

type DeleteAction = "trash" | "restore" | "delete";

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
 * Get the required permission for a specific action and table
 */
function getRequiredPermission(
  action: DeleteAction,
  tableName: string
): string | null {
  // Table-specific permissions
  const tablePermissions: Record<string, Record<DeleteAction, string>> = {
    participant_registrations: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    participant_visits: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    biospecimen_logs: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    adverse_events: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    off_study: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    participant_data_queries: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    shipments: {
      trash: SITE_PERMISSIONS.CAN_TRASH_ECRF,
      restore: SITE_PERMISSIONS.CAN_RESTORE_ECRF,
      delete: SITE_PERMISSIONS.CAN_DELETE_ECRF,
    },
    suspected_cases: {
      trash: SITE_PERMISSIONS.CAN_TRASH_SUSPECTED_CASES,
      restore: SITE_PERMISSIONS.CAN_RESTORE_SUSPECTED_CASES,
      delete: SITE_PERMISSIONS.CAN_DELETE_SUSPECTED_CASES,
    },
  };

  if (tablePermissions[tableName]?.[action]) {
    return tablePermissions[tableName][action];
  }

  // Unknown tables are denied by default.
  return null;
}

/**
 * Main authorization function for delete operations
 * 
 * @param schema - Database schema
 * @param tableName - Table name
 * @param recordId - Record ID to authorize
 * @param action - Type of delete action (trash, restore, delete)
 * @returns Authorization result
 */
export async function authorizeDeleteOperation(
  schema: string,
  tableName: string,
  recordId: number | string,
  action: DeleteAction
): Promise<AuthorizationResult> {

  // Get authentication context
  const ctx = await getAuthContext();

  if (!ctx) {
    return { authorized: false, reason: "Authentication required" };
  }

  // Check permission for the action
  const requiredPermission = getRequiredPermission(action, tableName);

  if (!requiredPermission) {
    return {
      authorized: false,
      reason: `${action} is not allowed for table "${tableName}"`,
    };
  }

  if (!ctx.roles.includes(requiredPermission)) {
    return {
      authorized: false,
      reason: `You do not have permission to ${action} ${tableName} records`,
    };
  }

  // Deny deletion for certain critical tables regardless of permissions
  if (NO_ACTION_PERMITTED.includes(tableName as NoActionTable)) {
    return {
      authorized: false,
      reason: `Records deletion not permitted on this table.`,
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

    if (!hasAccess) {
      const actionVerb = action === "trash" ? "delete" : action;
      return {
        authorized: false,
        reason: `You can only ${actionVerb} records from your clinical site. This record belongs to ${siteName}.`,
      };
    }

    return { authorized: true };
  } catch (error) {
    console.error("[AUTH] Error checking delete authorization:", error);
    return {
      authorized: false,
      reason: "Failed to verify authorization for this operation",
    };
  }
}

/**
 * Batch authorization for multiple delete operations
 * 
 * @param schema - Database schema
 * @param tableName - Table name
 * @param recordIds - Array of record IDs to authorize
 * @param action - Type of delete action
 * @returns Map of authorization results for each record
 */
export async function authorizeMultipleDeletes(
  schema: string,
  tableName: string,
  recordIds: (number | string)[],
  action: DeleteAction
): Promise<{
  authorized: Map<number | string, boolean>;
  deniedReasons: Map<number | string, string>;
}> {
  const authorized = new Map<number | string, boolean>();
  const deniedReasons = new Map<number | string, string>();

  await Promise.all(
    recordIds.map(async (id) => {
      const result = await authorizeDeleteOperation(schema, tableName, id, action);

      authorized.set(id, result.authorized);

      if (!result.authorized) {
        deniedReasons.set(id, result.reason);
      }
    })
  );

  return { authorized, deniedReasons };
}
