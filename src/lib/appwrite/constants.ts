export const APPWRITE_SESSION_COOKIE = "vm_appwrite_session";
export const OAUTH_LOGIN_NONCE_COOKIE = "vm_oauth_login_nonce";

export const PRODUCTION_APP_HOSTNAME = "ieeevm.knurdz.org";
export const PRODUCTION_APP_ORIGIN = `https://${PRODUCTION_APP_HOSTNAME}`;

export const APPWRITE_TABLES = {
  profiles: "profiles",
  profileDetails: "profile_details",
  recommendationRequests: "recommendation_requests",
  recommendations: "recommendations",
  uomVerificationRequests: "uom_verification_requests",
  sbRoleAssignments: "sb_role_assignments",
  eventRoleAssignments: "event_role_assignments",
  ieeeTerms: "ieee_terms",
  systemSettings: "system_settings",
  topBoardExclusions: "top_board_exclusions",
  auditLogs: "audit_logs",
  conclusionReports: "conclusion_reports",
  reportApprovals: "report_approvals",
  gradeRequests: "grade_requests",
  gradeReviews: "grade_reviews",
  pointLedger: "point_ledger",
  recognitionSnapshots: "recognition_snapshots",
  termScoringConfig: "term_scoring_config",
  events: "events",
  eventCommittees: "event_committees",
  eventCommitteeMembers: "event_committee_members",
  notifications: "notifications",
  notificationPreferences: "notification_preferences",
  formConnections: "form_connections",
  lavaForms: "lava_forms",
  lavaFormFields: "lava_form_fields",
  lavaFormSubmissions: "lava_form_submissions",
  lavaFormUniqueKeys: "lava_form_unique_keys",
} as const;

export const APPWRITE_BUCKETS = {
  conclusionReportFiles: "conclusion_report_files",
  profileAvatars: "profile_avatars",
  lavaFormFiles: "lava_form_files",
} as const;

export const UOM_VERIFICATION_CODE_TTL_MINUTES = 15;
export const UOM_VERIFICATION_MAX_ATTEMPTS = 5;
