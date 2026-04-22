
export type BypassTable = typeof BYPASS_CLINICAL_SITE_CHECK[number];
export type NoActionTable = typeof NO_ACTION_PERMITTED[number];

export const NO_ACTION_PERMITTED = [
  "auth_sessions", "fk_map",
  "no_group_notifications",
  "ref_changelog",
  "participant_identifiers", // Deletion of participant identifiers is not allowed, only soft delete via status/soft_delete fields
] as const;

/**
 * Tables that bypass clinical site authorization
 */
export const BYPASS_CLINICAL_SITE_CHECK = [
  "system_settings",
  "google_drive_cache",
  "organisations",
  "biospecimen_types",
  "visit_types",
  "shipments",
] as const;


/**
 * Table relationship mappings for clinical site resolution
 * Defines how to traverse relationships to find the clinical_site for each table
 */
export const TABLE_RELATIONSHIPS: Record<
  string,
  {
    hasClinicalSite?: boolean;
    findClinicalSiteVia?: {
      joinTable: string;
      joinColumn: string;
      targetColumn: string;
    }[];
  }
> = {
  // Tables with direct clinical_site column
  participant_registrations: { hasClinicalSite: true },
  suspected_cases: { hasClinicalSite: true },
  participant_identifiers: { hasClinicalSite: true },

  // Tables that need to traverse relationships
  participant_visits: {
    findClinicalSiteVia: [
      {
        joinTable: "participant_registrations",
        joinColumn: "participant_id",
        targetColumn: "id",
      },
    ],
  },

  biospecimen_logs: {
    findClinicalSiteVia: [
      {
        joinTable: "participant_visits",
        joinColumn: "visit_id",
        targetColumn: "id",
      },
      {
        joinTable: "participant_registrations",
        joinColumn: "participant_id",
        targetColumn: "id",
      },
    ],
  },

  // shipments: {
  //   findClinicalSiteVia: [
  //     {
  //       joinTable: "participant_visits",
  //       joinColumn: "visit_id",
  //       targetColumn: "id",
  //     },
  //     {
  //       joinTable: "participant_registrations",
  //       joinColumn: "participant_id",
  //       targetColumn: "id",
  //     },
  //   ],
  // },

  adverse_events: {
    findClinicalSiteVia: [
      {
        joinTable: "participant_registrations",
        joinColumn: "participant_id",
        targetColumn: "id",
      },
    ],
  },

  off_study: {
    findClinicalSiteVia: [
      {
        joinTable: "participant_registrations",
        joinColumn: "participant_id",
        targetColumn: "id",
      },
    ],
  },

  participant_data_queries: {
    findClinicalSiteVia: [
      {
        joinTable: "participant_registrations",
        joinColumn: "participant_id",
        targetColumn: "id",
      },
    ],
  },
};
