import { SelectQueryBuilder } from "@/lib/queries/types";

// PRIVATE
import { buildParticipantIdentifiersQuery } from "./ontologies/participant-identifiers";
import { buildParticipantRegistrationsQuery } from "./ecrfs/participant-registration";
import { buildParticipantVisitsQuery } from "./ecrfs/participant-visits";
import { biospecimenLogsQuery } from "./ecrfs/biospecimen-logs";
import { buildOffStudyQuery } from "./ecrfs/off-study";
import { buildShipmentsQuery } from "./ecrfs/shipments";
import { buildShipmentsReceivingQuery } from "./labs/shipments-receiving";
import { buildShippingTemplateQuery } from "./ecrfs/shipping-template";
import { adverseEventsQuery } from "./ecrfs/adverse-events";
import { participantDataQueriesQuery } from "./ecrfs/participant-data-queries";
import { analysisScheduleQuery } from "./labs/analysis-schedule";
import { buildSuspectedCasesQuery } from "./ecrfs/suspected-cases";
import { buildSuspectedCasesStatsQuery } from "./ecrfs/suspected-cases-stats";
import { buildStorageTemperaturesQuery } from "./ontologies/storage-temperature";
import { buildOrganisationsQuery } from "./ontologies/organisation";
import { buildParticipantPhenoClinicalDataQuery } from "./ecrfs/participant-pheno-clinical-data";
import { defaultSelectQuery } from "./ontologies/default";

// PUBLIC
import { buildParticipantRegistrationsAnalyticsQuery } from "./public/participant-registrations-analytics";
import { buildParticipantRecruitmentByCountryQuery } from "./public/participant-recruitment-by-country";
import { buildIembaseDiagnosesExplorerQuery } from "./public/iembase-diagnoses-explorer";

// SHARED / SYSTEM
import { authAndNotificationsQuery } from "./administrative/auth-notification";
import { systemSettingsQuery } from "./administrative/system-settings";
import { buildStudySiteStatusQuery } from "./administrative/study-site-status";
import { buildViewsQuery } from "./administrative/views";
import { buildCentralResourceQuery } from "./administrative/central-resource";
import { buildContactsQuery } from "./administrative/recon4imd-contacts";
import { buildFeedbacksQuery } from "./administrative/feedbacks";

export const SELECT_QUERY_REGISTRY: Record<string, SelectQueryBuilder> = {
  // PRIVATE (permissioned / user-scoped data)
  participant_registrations: buildParticipantRegistrationsQuery,
  participant_visits: buildParticipantVisitsQuery,
  biospecimen_logs: biospecimenLogsQuery,
  shipments: buildShipmentsQuery,
  shipments_receiving: buildShipmentsReceivingQuery,
  shipping_template: buildShippingTemplateQuery,
  off_study: buildOffStudyQuery,
  adverse_events: adverseEventsQuery,
  participant_data_queries: participantDataQueriesQuery,
  analysis_schedule: analysisScheduleQuery,
  suspected_cases: buildSuspectedCasesQuery,
  suspected_cases_stats: buildSuspectedCasesStatsQuery,
  participant_pheno_clinical_data: buildParticipantPhenoClinicalDataQuery,

  // administrative
  auth_sessions: authAndNotificationsQuery,
  no_group_notifications: authAndNotificationsQuery,
  download_activity_logs: authAndNotificationsQuery,
  system_settings: systemSettingsQuery,
  google_drive_cache: buildCentralResourceQuery,
  contacts: buildContactsQuery,
  feedbacks: buildFeedbacksQuery,

  // PUBLIC (analytics / explorer / aggregated)
  participant_registrations_analytics:
    buildParticipantRegistrationsAnalyticsQuery,
  participant_recruitment_by_country: buildParticipantRecruitmentByCountryQuery,
  iembase_diagnoses_explorer: buildIembaseDiagnosesExplorerQuery,

  // SHARED / SYSTEM (views, lookups, logs)
  study_site_status: buildStudySiteStatusQuery,
  v_available_aliquots: buildViewsQuery,
  v_biospecimen_with_aliquots: buildViewsQuery,
  v_ref_changelog: buildViewsQuery,

  // Ontologies Tables
  organisations: buildOrganisationsQuery,
  storage_temperatures: buildStorageTemperaturesQuery,
  participant_identifiers: buildParticipantIdentifiersQuery,
  iembase_diagnoses: defaultSelectQuery,

  age_at_onset_of_symptoms: defaultSelectQuery,
  affected_statuses: defaultSelectQuery,
  aliquots: defaultSelectQuery,
  aliquots_temperature: defaultSelectQuery,
  assigned_gender_at_birth: defaultSelectQuery,
  biospecimen_types: defaultSelectQuery,
  case_resolution_status: defaultSelectQuery,
  clinical_status: defaultSelectQuery,
  contact_job_titles: defaultSelectQuery,
  contact_roles: defaultSelectQuery,
  contact_groups: defaultSelectQuery,
  consanguinity: defaultSelectQuery,
  countries: defaultSelectQuery,
  data_manager_review: defaultSelectQuery,
  diseases: defaultSelectQuery,
  expectedness: defaultSelectQuery,
  fibroblast_provisions: defaultSelectQuery,
  feedback_status: defaultSelectQuery,
  feedback_types: defaultSelectQuery,
  future_use_of_data: defaultSelectQuery,
  future_use_of_samples: defaultSelectQuery,
  heidelberg_pif_icf: defaultSelectQuery,
  life_status: defaultSelectQuery,
  off_study_status: defaultSelectQuery,
  organisation_types: defaultSelectQuery,
  outcome: defaultSelectQuery,
  participant_cohorts: defaultSelectQuery,
  pedigree: defaultSelectQuery,
  participant_registries: defaultSelectQuery,
  participant_treatments: defaultSelectQuery,
  query_status: defaultSelectQuery,
  query_types: defaultSelectQuery,
  relationship_to_biopsy: defaultSelectQuery,
  report_type: defaultSelectQuery,
  seriousness_criteria: defaultSelectQuery,
  severity_grade: defaultSelectQuery,
  shipment_destinations: defaultSelectQuery,
  shipment_status: defaultSelectQuery,
  specimen_placed: defaultSelectQuery,
  testing_outcome: defaultSelectQuery,
  urine_collection: defaultSelectQuery,
  visit_types: defaultSelectQuery,
  unsolved_samples_types: defaultSelectQuery,

};
