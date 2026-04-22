import { pgPool } from "@/lib/db";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { quoteIdent } from "@/lib/queries/helper";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";

/**
 * Fetch organisations with optional name filtering
 */
export async function getOrganisations(
  schema: string,
  filters: Record<string, string> = {},
  groups: string[] = [],
) {
  const client = await pgPool.connect();
  const { roles } = await getUserGroupsFromSession();

  try {
    let sql = `
      SELECT 
        orgs.name,
        orgs.id,
        orgs.order,
        orgs.country,
        orgs.created_at,
        orgs.updated_at,
        org_types.name AS organisation_type_name,
        country_names.name AS country_name
      FROM ${quoteIdent(schema)}.organisations AS orgs
      LEFT JOIN ${quoteIdent(schema)}.organisation_types AS org_types
        ON orgs.type = org_types.id
      LEFT JOIN ${quoteIdent(schema)}.countries AS country_names
        ON orgs.country = country_names.id
    `;

    const params: unknown[] = [];
    const isContactPage = filters.is_contact_page === "true"; // no clinical site filtering on contacts page for contact admins
    const isContactAdmin = roles.includes(SITE_PERMISSIONS.CAN_CONTACTS_ADMIN);
    const shouldFilterByGroup = !(isContactPage && isContactAdmin);

    if (groups.length > 0 && shouldFilterByGroup) {
      const placeholders = groups.map((_, i) => `$${i + 1}`).join(", ");
      sql += ` WHERE orgs.name IN (${placeholders})`;
      params.push(...groups);
    }

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch storage temperatures with biospecimen type
 */
export async function getStorageTemperatures(schema: string) {
  const client = await pgPool.connect();

  try {
    const sql = `
      SELECT 
        storg.id,
        storg.order,
        storg.name,
        biospec.name AS biospecimen_type_name
      FROM ${quoteIdent(schema)}.storage_temperatures AS storg
      LEFT JOIN ${quoteIdent(schema)}.biospecimen_types AS biospec
        ON storg.biospecimen_type = biospec.id
      ORDER BY storg.order ASC
    `;

    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch participant identifiers with optional status + group filtering
 */
export async function getParticipantIdentifiers(
  schema: string,
  filters: Record<string, string> = {},
  groups: string[] = [],
) {
  const client = await pgPool.connect();

  try {
    let sql = `
      SELECT 
        p_ids.*,
        orgs.name AS clinical_site_name
      FROM ${quoteIdent(schema)}.participant_identifiers AS p_ids
      LEFT JOIN ${quoteIdent(schema)}.organisations AS orgs
        ON p_ids.clinical_site = orgs.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // status / soft_delete filter
    if (filters.status === "Available" || filters.soft_delete === "false") {
      whereClauses.push(
        `p_ids.status = 'Available' AND p_ids.soft_delete = false`,
      );
    }

    // group filter on organisation name
    if (groups.length > 0) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`orgs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch participant registrations with optional call + group filtering
 */
export async function getParticipantRegistrations(
  schema: string,
  // filters: Record<string, string> = {},
  groups: string[] = [],
) {
  const client = await pgPool.connect();

  try {
    let sql = `
      SELECT
        pr.*,
        pids.identifier  AS participant_id_code,
        cs.name          AS clinical_site_name,
        agb.name         AS gender_at_birth_name,
        coh.name         AS cohort_assignment_name,
        ds.name          AS disease_severity_name,
        diag.name        AS iembase_diagnoses_name,
        reg.name         AS registry_name,
        hei_pif.name     AS informed_consent_details_name
      FROM ${quoteIdent(schema)}.participant_registrations AS pr
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
        ON pr.participant_id = pids.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pr.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.assigned_gender_at_birth AS agb
        ON pr.gender_at_birth = agb.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_cohorts AS coh
        ON pr.cohort_assignment = coh.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.diseases AS ds
        ON pr.disease_severity = ds.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.iembase_diagnoses AS diag
        ON pr.iembase_diagnoses = diag.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_registries AS reg
        ON pr.participant_data_registration = reg.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.heidelberg_pif_icf AS hei_pif
        ON pr.informed_consent_details = hei_pif.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // ALWAYS exclude soft-deleted & draft records
    whereClauses.push(`COALESCE(pr.soft_delete, false) = false`);
    whereClauses.push(`COALESCE(pr.draft, false) = false`);

    // Exclude participants who are off-study with data withdrawn
    whereClauses.push(`
      NOT EXISTS (
        SELECT 1
        FROM ${quoteIdent(schema)}.off_study os
        WHERE os.participant_id = pr.id
          AND (COALESCE(os.soft_delete, false) = false)
          AND (COALESCE(os.draft, false) = false)
          AND os.withdraw_data = (
            SELECT id FROM ${quoteIdent("imdhub_refs")}.future_use_of_data
            WHERE code = 'data_deleted'
            LIMIT 1
          )
      )
    `);

    // Optional group filter
    if (groups.length > 0) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    sql += `\nWHERE ` + whereClauses.join("\n  AND ");

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch participant visits with optional clinical site filtering
 */
export async function getParticipantVisits(
  schema: string,
  groups: string[] = [],
) {
  const client = await pgPool.connect();

  try {
    let sql = `
      SELECT
        pv.*,
        pids.identifier AS participant_id_code,
        cs.name         AS clinical_site_name,
        vt.name         AS visit_type_name,
        pt.name         AS treatment_name,
        pr.cohort_assignment AS participant_cohort_assignment
      FROM ${quoteIdent(schema)}.participant_visits AS pv
      LEFT JOIN ${quoteIdent(schema)}.participant_registrations AS pr
        ON pv.participant_id = pr.id
        AND pr.soft_delete = false
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
        ON pr.participant_id = pids.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pr.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.visit_types AS vt
        ON pv.visit_type_id = vt.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_treatments AS pt
        ON pv.treatment_id = pt.id
    `;

    const params: unknown[] = [];

    if (groups.length > 0) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      sql += ` WHERE cs.name IN (${placeholders})`;
      params.push(...groups);
    }

    // Exclude participants who are off-study with data withdrawn
    sql += `${groups.length > 0 ? "\n  AND" : "\nWHERE"} NOT EXISTS (
      SELECT 1
      FROM ${quoteIdent(schema)}.off_study os
      WHERE os.participant_id = pr.id
        AND (COALESCE(os.soft_delete, false) = false)
        AND (COALESCE(os.draft, false) = false)
        AND os.withdraw_data = (
          SELECT id FROM ${quoteIdent("imdhub_refs")}.future_use_of_data
          WHERE code = 'data_deleted'
          LIMIT 1
        )
    )`;

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch available aliquots with optional organisation filtering
 */
export async function getAvailableAliquots(groups: string[] = []) {
  const client = await pgPool.connect();

  try {
    let sql = `
      SELECT *
      FROM imdhub_core.v_available_aliquots
    `;

    const params: unknown[] = [];

    if (groups.length > 0) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      sql += ` WHERE organisation_name IN (${placeholders})`;
      params.push(...groups);
    }

    sql += ` ORDER BY aliquot_identifier`;

    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch IEMbase diagnoses with recruited participant count
 */
export async function getIembaseDiagnoses(schema: string) {
  const client = await pgPool.connect();

  try {
    const sql = `
      SELECT 
        diag.id,
        diag."iembase_name" || ' (' ||
          COALESCE(diag."gene_symbol", '') || ' / ' ||
          COALESCE(diag."code", '') || ')' AS name,
        diag."gene_symbol",
        diag.alternative_names,
        diag.iembase_url,
        diag.min_group_size,
        diag."code",
        diag."created_at",
        diag."updated_at",
        (
          SELECT COUNT(*)
          FROM imdhub_core.participant_registrations pr
          WHERE pr.iembase_diagnoses = diag.id
            AND pr.soft_delete = false
            AND COALESCE(pr.draft, false) = false
        ) AS recruited_count
      FROM ${quoteIdent(schema)}.iembase_diagnoses AS diag
      WHERE (diag.draft IS NULL OR diag.draft = false)
        AND (diag.soft_delete IS NULL OR diag.soft_delete = false)
      ORDER BY diag."gene_symbol" ASC
    `;

    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Generic lookup for simple reference tables
 * Assumes columns:
 * - id
 * - name
 * - label (optional but expected by UI)
 * - order
 * - draft
 * - soft_delete
 */
export async function getGenericLookup(schema: string, tableName: string) {
  const client = await pgPool.connect();

  try {
    const sql = `
            SELECT
                id,
                name,
                label,
                created_at,
                updated_at
            FROM ${quoteIdent(schema)}.${quoteIdent(tableName)}
            WHERE (draft IS NULL OR draft = false)
                AND (soft_delete IS NULL OR soft_delete = false)
            ORDER BY "order" ASC
            `;

    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}
