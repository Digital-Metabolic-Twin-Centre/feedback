import { SelectQueryBuilder } from "@/lib/queries/types";

import { buildOrganisationsQuery } from "./ontologies/organisation";
import { defaultSelectQuery } from "./ontologies/default";

import { authAndNotificationsQuery } from "./administrative/auth-notification";
import { systemSettingsQuery } from "./administrative/system-settings";
import { buildViewsQuery } from "./administrative/views";
import { buildCentralResourceQuery } from "./administrative/central-resource";
import { buildFeedbacksQuery } from "./administrative/feedbacks";

export const SELECT_QUERY_REGISTRY: Record<string, SelectQueryBuilder> = {
  // Feedback
  feedbacks: buildFeedbacksQuery,

  // System / administrative
  auth_sessions: authAndNotificationsQuery,
  no_group_notifications: authAndNotificationsQuery,
  system_settings: systemSettingsQuery,
  google_drive_cache: buildCentralResourceQuery,
  v_ref_changelog: buildViewsQuery,

  // Ontologies
  organisations: buildOrganisationsQuery,
  feedback_status: defaultSelectQuery,
  feedback_types: defaultSelectQuery,
  countries: defaultSelectQuery,
};

