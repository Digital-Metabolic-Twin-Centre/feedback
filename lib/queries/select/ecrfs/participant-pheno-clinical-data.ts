import { SelectQueryBuilder } from "@/lib/queries/types";
import { quoteIdent } from "@/lib/queries/helper";
import { ADMIN_GROUP_VIEW_PERMISSIONS } from "@/lib/permissions";

export const buildParticipantPhenoClinicalDataQuery: SelectQueryBuilder = {
  select: ({ schema, filters, groups }) => {
    let sql = `
      SELECT
        prpcd.*,
        pids.identifier  AS participant_id_code,
        cs.name          AS clinical_site_name,
        cst.name         AS clinical_status_name,
        pdg.name         AS pedigree_name,
        crs.name         AS case_resolution_status_name,
        ls.name          AS life_status_name,
        aos.name         AS age_at_onset_of_symptoms_name,
        cons.name        AS consanguinity_name
      FROM ${quoteIdent(schema)}.participant_pheno_clinical_data AS prpcd
      LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers AS pids
        ON prpcd.participant_identifier = pids.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations AS cs
        ON pids.clinical_site = cs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.clinical_status AS cst
        ON prpcd.clinical_status = cst.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.pedigree AS pdg
        ON prpcd.pedigree = pdg.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.case_resolution_status AS crs
        ON prpcd.case_resolution_status = crs.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.life_status AS ls
        ON prpcd.life_status = ls.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.age_at_onset_of_symptoms AS aos
        ON prpcd.age_at_onset = aos.id
      LEFT JOIN ${quoteIdent("imdhub_refs")}.consanguinity AS cons
        ON prpcd.consanguinity = cons.id
    `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    // Soft delete / draft filters
    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";
    if (isTrashed) {
      whereClauses.push(`prpcd.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`prpcd.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (prpcd.soft_delete IS NULL OR prpcd.soft_delete = false)
        AND (prpcd.draft IS NULL OR prpcd.draft = false)
      `);
    }
    // ALL records do NOTHING

    // group-filter on clinical_site name
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += `\nWHERE ` + whereClauses.join("\n  AND ");
    }

    return { sql, params };
  },

  count: ({ schema, filters, groups }) => {
    let sql = `
        SELECT COUNT(DISTINCT prpcd.id) AS count
        FROM ${quoteIdent(schema)}.participant_pheno_clinical_data prpcd
        LEFT JOIN ${quoteIdent("imdhub_refs")}.participant_identifiers pids
          ON prpcd.participant_identifier = pids.id
        LEFT JOIN ${quoteIdent("imdhub_refs")}.organisations cs
          ON pids.clinical_site = cs.id
      `;

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    const isTrashed = filters.soft_delete === "true";
    const isDraft = filters.draft === "true";
    const isActive =
      filters.soft_delete === "false" &&
      filters.draft === "false";

    // Trashed only
    if (isTrashed) {
      whereClauses.push(`prpcd.soft_delete = true`);
    }
    else if (isDraft) {
      whereClauses.push(`prpcd.draft = true`);
    }
    else if (isActive) {
      whereClauses.push(`
        (prpcd.soft_delete IS NULL OR prpcd.soft_delete = false)
        AND (prpcd.draft IS NULL OR prpcd.draft = false)
      `);
    } // ALL records do NOTHING

    // group-filter on clinical_site name
    if (groups.length > 0 && !groups.includes(ADMIN_GROUP_VIEW_PERMISSIONS)) {
      const placeholders = groups
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      whereClauses.push(`cs.name IN (${placeholders})`);
      params.push(...groups);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(" AND ");
    }

    return { sql, params };
  },


};
