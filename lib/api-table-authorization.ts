import { publicTables } from "@/lib/constants";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/api-error";

type TableAccessRule = {
  allOf?: string[];
  anyOf?: string[];
  public?: boolean;
};

type DeleteAction = "trash" | "restore" | "delete";

const ONTOLOGY_TABLES = [
  "organisations",
  "storage_temperatures",
  "iembase_diagnoses",
  "age_at_onset_of_symptoms",
  "affected_statuses",
  "aliquots",
  "aliquots_temperature",
  "assigned_gender_at_birth",
  "biospecimen_types",
  "case_resolution_status",
  "clinical_status",
  "contact_job_titles",
  "contact_roles",
  "contact_groups",
  "consanguinity",
  "countries",
  "data_manager_review",
  "diseases",
  "expectedness",
  "feedback_types",
  "feedback_status",
  "fibroblast_provisions",
  "future_use_of_data",
  "future_use_of_samples",
  "heidelberg_pif_icf",
  "life_status",
  "off_study_status",
  "organisation_types",
  "outcome",
  "participant_cohorts",
  "pedigree",
  "participant_registries",
  "participant_treatments",
  "query_status",
  "query_types",
  "relationship_to_biopsy",
  "report_type",
  "seriousness_criteria",
  "severity_grade",
  "shipment_destinations",
  "shipment_status",
  "specimen_placed",
  "testing_outcome",
  "urine_collection",
  "visit_types",
  "unsolved_samples_types",
] as const;

const ECRF_TABLES = [
  "participant_registrations",
  "participant_visits",
  "biospecimen_logs",
  "shipments",
  "off_study",
  "adverse_events",
  "participant_data_queries",
] as const;

const CREATE_RULES: Record<string, TableAccessRule> = {
  ...Object.fromEntries(
    ONTOLOGY_TABLES.map((table) => [
      table,
      {
        allOf: [
          SITE_PERMISSIONS.CAN_ACCESS_ONTOLOGIES,
          SITE_PERMISSIONS.CAN_CREATE,
        ],
      },
    ]),
  ),
  ...Object.fromEntries(
    ECRF_TABLES.map((table) => [
      table,
      {
        allOf: [
          SITE_PERMISSIONS.CAN_ACCESS_ECRF,
          SITE_PERMISSIONS.CAN_CREATE_ECRF,
        ],
      },
    ]),
  ),
  contacts: {
    allOf: [
      SITE_PERMISSIONS.CAN_ACCESS_CONTACTS,
      SITE_PERMISSIONS.CAN_CONTACTS_ADMIN,
    ],
  },
  suspected_cases: {
    allOf: [
      SITE_PERMISSIONS.CAN_ACCESS_SUSPECTED_CASES,
      SITE_PERMISSIONS.CAN_CREATE_SUSPECTED_CASES,
    ],
  },
  participant_pheno_clinical_data: {
    allOf: [
      SITE_PERMISSIONS.CAN_ACCESS_UNDIAGNOSED_CASES,
      SITE_PERMISSIONS.CAN_CREATE,
    ],
  },
  study_site_status: {
    allOf: [
      SITE_PERMISSIONS.CAN_ACCESS_STUDY_SITE_STATUS,
      SITE_PERMISSIONS.CAN_CREATE,
    ],
  },
  system_settings: {
    allOf: [SITE_PERMISSIONS.CAN_SET_SYSTEM_SETTINGS],
  },
  participant_identifiers: {
    allOf: [SITE_PERMISSIONS.CAN_GENERATE_PID],
  },
  feedbacks: {},
};

const SELECT_RULES: Record<string, TableAccessRule> = {
  ...Object.fromEntries(
    ONTOLOGY_TABLES.map((table) => [
      table,
      { allOf: [SITE_PERMISSIONS.CAN_ACCESS_ONTOLOGIES] },
    ]),
  ),
  ...Object.fromEntries(
    ECRF_TABLES.map((table) => [
      table,
      { allOf: [SITE_PERMISSIONS.CAN_ACCESS_ECRF] },
    ]),
  ),
  participant_identifiers: {
    allOf: [SITE_PERMISSIONS.CAN_VIEW_PID],
  },
  shipments_receiving: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB],
  },
  analysis_schedule: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB],
  },
  suspected_cases: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_SUSPECTED_CASES],
  },
  suspected_cases_stats: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_SUSPECTED_CASES],
  },
  participant_pheno_clinical_data: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_UNDIAGNOSED_CASES],
  },
  contacts: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_CONTACTS],
  },
  feedbacks: {},
  auth_sessions: {
    allOf: [SITE_PERMISSIONS.CAN_VIEW_ACCESS_LOGS],
  },
  no_group_notifications: {
    allOf: [SITE_PERMISSIONS.CAN_VIEW_ACCESS_LOGS],
  },
  download_activity_logs: {
    allOf: [SITE_PERMISSIONS.CAN_VIEW_ACCESS_LOGS],
  },
  system_settings: {
    allOf: [SITE_PERMISSIONS.CAN_SET_SYSTEM_SETTINGS],
  },
  google_drive_cache: {
    allOf: [SITE_PERMISSIONS.CAN_SYNC_GOOGLE_FILES],
  },
  v_ref_changelog: {
    allOf: [SITE_PERMISSIONS.CAN_VIEW_AUDIT_LOGS],
  },
  v_biospecimen_with_aliquots: {
    allOf: [SITE_PERMISSIONS.CAN_ACCESS_ECRF],
  },
  v_available_aliquots: {
    anyOf: [
      SITE_PERMISSIONS.CAN_ACCESS_ECRF,
      SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB,
    ],
  },
  shipping_template: {
    public: true,
  } as TableAccessRule,
};

const ECRF_UPDATE_TARGETS = [
  ...ECRF_TABLES,
  "mark_shipment_as_shipped",
  "mark_shipment_as_received",
] as const;

const UPDATE_RULES: Record<string, TableAccessRule> = {
  ...Object.fromEntries(
    ONTOLOGY_TABLES.map((table) => [table, { allOf: [SITE_PERMISSIONS.CAN_UPDATE] }]),
  ),
  ...Object.fromEntries(
    ECRF_UPDATE_TARGETS.map((table) => [
      table,
      { allOf: [SITE_PERMISSIONS.CAN_UPDATE_ECRF] },
    ]),
  ),
  contacts: {
    allOf: [SITE_PERMISSIONS.CAN_CONTACTS_ADMIN],
  },
  suspected_cases: {
    allOf: [SITE_PERMISSIONS.CAN_UPDATE_SUSPECTED_CASES],
  },
  participant_pheno_clinical_data: {
    allOf: [SITE_PERMISSIONS.CAN_UPDATE],
  },
  study_site_status: {
    allOf: [SITE_PERMISSIONS.CAN_UPDATE],
  },
  system_settings: {
    allOf: [SITE_PERMISSIONS.CAN_SET_SYSTEM_SETTINGS],
  },
  participant_identifiers: {
    allOf: [SITE_PERMISSIONS.CAN_UPDATE],
  },
  feedbacks: {},
};

const DELETE_RULES: Record<
  string,
  { trash: TableAccessRule; restore: TableAccessRule; delete: TableAccessRule }
> = {
  ...Object.fromEntries(
    ONTOLOGY_TABLES.map((table) => [
      table,
      {
        trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH] },
        restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
        delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
      },
    ]),
  ),
  ...Object.fromEntries(
    ECRF_TABLES.map((table) => [
      table,
      {
        trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH_ECRF] },
        restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE_ECRF] },
        delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE_ECRF] },
      },
    ]),
  ),
  contacts: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
  },
  suspected_cases: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH_SUSPECTED_CASES] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE_SUSPECTED_CASES] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE_SUSPECTED_CASES] },
  },
  participant_pheno_clinical_data: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
  },
  study_site_status: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
  },
  system_settings: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
  },
  feedbacks: {
    trash: { allOf: [SITE_PERMISSIONS.CAN_TRASH] },
    restore: { allOf: [SITE_PERMISSIONS.CAN_RESTORE] },
    delete: { allOf: [SITE_PERMISSIONS.CAN_DELETE] },
  },
};

function hasAllRoles(roles: string[], required: string[] = []): boolean {
  return required.every((role) => roles.includes(role));
}

function hasAnyRole(roles: string[], required: string[] = []): boolean {
  return required.length === 0 || required.some((role) => roles.includes(role));
}

function assertAllowedByRule(
  roles: string[],
  rule: TableAccessRule | undefined,
  action: "create" | "select" | "update" | DeleteAction,
  tableName: string,
) {
  if (!rule) {
    throw new ApiError(
      `Forbidden: ${action} is not allowed for table "${tableName}"`,
      403,
    );
  }

  if (rule.allOf && !hasAllRoles(roles, rule.allOf)) {
    throw new ApiError(
      `Forbidden: insufficient permissions to ${action} "${tableName}"`,
      403,
    );
  }

  if (rule.anyOf && !hasAnyRole(roles, rule.anyOf)) {
    throw new ApiError(
      `Forbidden: insufficient permissions to ${action} "${tableName}"`,
      403,
    );
  }
}

export function assertCreateTableAccess(
  roles: string[],
  tableName: string,
): void {
  assertAllowedByRule(roles, CREATE_RULES[tableName], "create", tableName);
}

export function assertSelectTableAccess(
  roles: string[],
  tableName: string,
): void {
  if (publicTables.has(tableName)) {
    return;
  }

  assertAllowedByRule(roles, SELECT_RULES[tableName], "select", tableName);
}

export function assertUpdateTableAccess(
  roles: string[],
  tableName: string,
  source?: string,
): void {
  let rule = UPDATE_RULES[tableName];

  if (tableName === "off_study" && source === "labs_sample_withdrawal") {
    rule = {
      anyOf: [
        SITE_PERMISSIONS.CAN_UPDATE_ECRF,
        SITE_PERMISSIONS.CAN_ACCESS_PRY_LAB,
      ],
    };
  }

  assertAllowedByRule(roles, rule, "update", tableName);
}

export function assertDeleteTableAccess(
  roles: string[],
  tableName: string,
  action: DeleteAction,
): void {
  const rule = DELETE_RULES[tableName]?.[action];

  assertAllowedByRule(roles, rule, action, tableName);
}

export function assertHasAllPermissions(
  roles: string[],
  requiredRoles: string[],
  actionDescription: string,
): void {
  if (!hasAllRoles(roles, requiredRoles)) {
    throw new ApiError(
      `Forbidden: insufficient permissions to ${actionDescription}`,
      403,
    );
  }
}
