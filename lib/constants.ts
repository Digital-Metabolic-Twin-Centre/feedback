/**
 * Global form constants and shared types for the workspace.
 *
 * Centralises:
 *  - String literal constants (cohorts, sites, specimen types, etc.)
 *  - Derived union types for type-safety & autocompletion
 *  - Helper arrays that drive conditional form logic
 *  - Tab definitions for form navigation
 *
 * Goal: eliminate "magic strings", enforce consistency, and make form behaviour predictable.
 */

// Types
export type CohortConstantType =
  (typeof COHORT_TYPES)[keyof typeof COHORT_TYPES];
export type ClinicalSiteConstantType =
  (typeof CLINICAL_SITES)[keyof typeof CLINICAL_SITES];
export type GenderOptionConstantType =
  (typeof GENDER_OPTIONS)[keyof typeof GENDER_OPTIONS];
export type OtherOptionConstantType =
  (typeof OTHER_OPTIONS)[keyof typeof OTHER_OPTIONS];
export type SpecimenConstantType =
  (typeof SPECIMEN_TYPES)[keyof typeof SPECIMEN_TYPES];
export type FibroblastOptionConstantType =
  (typeof FIBROBLAST_OPTIONS)[keyof typeof FIBROBLAST_OPTIONS];
export type BiospecimenTabKey =
  (typeof BIOSPECIMEN_TABS)[keyof typeof BIOSPECIMEN_TABS];
export type ParticipantRegistrationTabKey =
  (typeof PARTICIPANT_REGISTRATION_TABS)[keyof typeof PARTICIPANT_REGISTRATION_TABS];
export type ShipmentTabKey = (typeof SHIPMENT_TABS)[keyof typeof SHIPMENT_TABS];

// Cohort types
export const COHORT_TYPES = {
  DIAGNOSED_IMD: "Diagnosed IMD (positive control cohort)",
  SUSPECTED_IMD: "Suspected IMD (test cohort)",
  GAUCHER_DISEASE: "Gaucher disease cohort (personalised patient management)",
  HEALTHY_RELATED: "Healthy participant related (negative control cohort)",
  HEALTHY_UNRELATED: "Healthy participant unrelated (negative control cohort)",
  NO_IMD: "Diagnosed with no IMD (negative control cohort)",
  BLINDED_CASE: "Blinded cases",
} as const;

// Specimen types
export const SPECIMEN_TYPES = {
  //** */
  URINE: "Urine",
  EDTA_PLASMA: "EDTA-Tube/Plasma",
  EDTA_BLOOD: "EDTA-Blood/DNA",
  PAXGENE_RNA: "PAXgene-RNA",
  FIBROBLAST: "Fibroblast",
  STOOL: "Stool",
} as const;

// Fibroblast options
export const FIBROBLAST_OPTIONS = {
  FROZEN_PELLETS: "Frozen cell pellets",
  LIVING_CULTURES: "Living cell cultures",
  FROZEN_CRYO_STOCKS: "Frozen cryo stocks",
} as const;

// Biospecimen tabs
export const BIOSPECIMEN_TABS = {
  BASIC_INFO: "basic_info", //** */
  URINE: "urine",
  EDTA_PLASMA: "edta_plasma",
  EDTA_BLOOD: "edta_blood",
  PAX_RNA: "pax_rna",
  FIBROBLAST: "fibroblast",
  FROZEN_PELLETS: "frozen_cell_pellets",
  LIVING_CULTURES: "living_cell_cultures",
  FROZEN_CRYO_STOCKS: "frozen_cryo_stocks",
  STOOL: "stool",
} as const;
export const biospecimenTabs: BiospecimenTabKey[] =
  Object.values(BIOSPECIMEN_TABS);

// Participant registration tabs
export const PARTICIPANT_REGISTRATION_TABS = {
  BASIC_INFO: "basic_info",
  COHORT: "cohort",
  CONSENT: "consent",
  REGISTRY: "registry",
  CRITERIA: "criteria",
} as const;
export const participantRegistrationTabs: ParticipantRegistrationTabKey[] =
  Object.values(PARTICIPANT_REGISTRATION_TABS);

// Shipment tabs
export const SHIPMENT_TABS = {
  BASIC_INFO: "basic_info",
} as const;
export const shipmentTabs: ShipmentTabKey[] = Object.values(SHIPMENT_TABS);

// Clinical sites
export const CLINICAL_SITES = {
  HEIDELBERG: "University Hospital Heidelberg",
  GREAT_ORMOND: "Great Ormond Street Hospital",
  MATER_HOSPITAL: "Mater Misericordiae University Hospital",
  SANTIAGO: "Foundation Health Research Institute of Santiago de Compostela",
} as const;

// Gender options
export const GENDER_OPTIONS = {
  FEMALE: "Female",
} as const;

// Other constants
export const OTHER_OPTIONS = {
  NOT_APPLICABLE: "Not Applicable",
  GENOMIT_OTHER: "GENOMIT, other diagnoses",
  REGISTRY_UIMD: "U-IMD",
  PLEASE_COMMENT: "none of the above, please comment",
  OTHER: "Other",
  OTHER_PLEASE_COMMENT: "other (please comment)",
  ROOM_AT_MAX_TEMP:
    "kept at room temperature for max. 30 mins, and then centrifuged.",
  OTHER_TREATMENT: "Other treatment",
  DEATH: "Death",
  WITHDRAWAL_OF_CONSENT: "Withdrawal of participant consent",
  EXTRAORDINARY_CIRCUMSTANCES: "Extraordinary medical circumstances",
  FOLLOW_UP: "Follow-up",
  FINAL: "Final",
  DESTROY_DATA: "Data deleted",
  DESTROY_SAMPLES: "Samples to be destroyed",
} as const;

// Helper arrays for conditional logic
export const COHORTS_WITH_STOOL_SAMPLING: CohortConstantType[] = [
  COHORT_TYPES.DIAGNOSED_IMD,
  COHORT_TYPES.BLINDED_CASE,
  COHORT_TYPES.SUSPECTED_IMD,
];

export const SITES_WITH_STOOL_SAMPLING: ClinicalSiteConstantType[] = [
  CLINICAL_SITES.HEIDELBERG,
  CLINICAL_SITES.GREAT_ORMOND,
  CLINICAL_SITES.MATER_HOSPITAL,
  CLINICAL_SITES.SANTIAGO,
];

export const COHORTS_WITHOUT_GENETIC_FIELDS: CohortConstantType[] = [
  COHORT_TYPES.HEALTHY_RELATED,
  COHORT_TYPES.HEALTHY_UNRELATED,
  // COHORT_TYPES.NO_IMD,
];

export const DIAGNOSED_IMD_GAUCHER: CohortConstantType[] = [
  COHORT_TYPES.DIAGNOSED_IMD,
  COHORT_TYPES.BLINDED_CASE,
  COHORT_TYPES.GAUCHER_DISEASE,
];

export const DIAGNOSED_IMD_GAUCHER_NO_BLINDED: CohortConstantType[] = [
  COHORT_TYPES.DIAGNOSED_IMD,
  COHORT_TYPES.GAUCHER_DISEASE,
];

export const HEALTHY_COHORTS: CohortConstantType[] = [
  COHORT_TYPES.HEALTHY_RELATED,
  COHORT_TYPES.HEALTHY_UNRELATED,
];

export const DIAGNOSED_IMD_GAUCHER_NO_IMD_SUSPECTED: CohortConstantType[] = [
  COHORT_TYPES.DIAGNOSED_IMD,
  COHORT_TYPES.BLINDED_CASE,
  COHORT_TYPES.GAUCHER_DISEASE,
  COHORT_TYPES.NO_IMD,
  COHORT_TYPES.SUSPECTED_IMD,
];

export const RESTRICTED_UIMD_COHORT_NAMES: CohortConstantType[] = [
  COHORT_TYPES.SUSPECTED_IMD,
  COHORT_TYPES.NO_IMD,
  COHORT_TYPES.HEALTHY_RELATED,
  COHORT_TYPES.HEALTHY_UNRELATED,
];

// Specimen types mapping based on visiting participant assigned cohorts
export const cohortSpecimenMap: Record<string, string[]> = {
  // Diagnosed IMD (positive control cohort)
  [COHORT_TYPES.DIAGNOSED_IMD]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
    SPECIMEN_TYPES.FIBROBLAST,
    SPECIMEN_TYPES.STOOL,
  ],

  // Blinded cases
  [COHORT_TYPES.BLINDED_CASE]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
    SPECIMEN_TYPES.FIBROBLAST,
    SPECIMEN_TYPES.STOOL,
  ],

  // Suspected IMD (test cohort)
  [COHORT_TYPES.SUSPECTED_IMD]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
    SPECIMEN_TYPES.EDTA_BLOOD,
    SPECIMEN_TYPES.PAXGENE_RNA,
    SPECIMEN_TYPES.FIBROBLAST,
    SPECIMEN_TYPES.STOOL,
  ],

  // Diagnosed with no IMD (negative control cohort)
  [COHORT_TYPES.NO_IMD]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
    SPECIMEN_TYPES.FIBROBLAST,
  ],

  // Gaucher disease cohort (personalised patient management)
  [COHORT_TYPES.GAUCHER_DISEASE]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
    SPECIMEN_TYPES.FIBROBLAST,
  ],

  // Healthy participant related (negative control cohort)
  [COHORT_TYPES.HEALTHY_RELATED]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
  ],

  // Healthy participant unrelated (negative control cohort)
  [COHORT_TYPES.HEALTHY_UNRELATED]: [
    SPECIMEN_TYPES.URINE,
    SPECIMEN_TYPES.EDTA_PLASMA,
  ],
};


// Participant 
export const QUERY_TYPES = ["Missing Value", "Outlier",
  "Inconsistent", "Illegible Data", "Logic Error"] as const;
export const DATA_MANAGER_REVIEWS = ["Accepted", "Rejected"] as const;
export const QUERY_STATUSES = ["Open", "Answered", "Closed"] as const;

export const FEEDBACK_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;

// Shipment status constants
export const SHIPMENT_STATUS = {
  SHIPMENT_RECEIVED: "Received",
  SHIPMENT_MADE: "Shipped",
  SHIPMENT_PENDING: "Pending",
  SHIPMENT_TRACKING_MODE_FORM: "tracking",
  SHIPMENT_RECEIVING_MODE_FORM: "receiving",
} as const;



// Public tables that don't require authentication7
export const publicTables = new Set([
  "participant_registrations_analytics",
  "participant_recruitment_by_country",
  "iembase_diagnoses_explorer",
  "study_site_status",
  "v_available_aliquots",
  "shipping_template",
  // Feedback section is open without authentication
  "feedbacks",
  "feedback_types",
  "feedback_status",
  "organisations",
]);
