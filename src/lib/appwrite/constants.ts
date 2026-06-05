export const APPWRITE_SESSION_COOKIE = "vm_appwrite_session";

export const APPWRITE_TABLES = {
  profiles: "profiles",
  uomVerificationRequests: "uom_verification_requests",
  sbRoleAssignments: "sb_role_assignments",
  eventRoleAssignments: "event_role_assignments",
  ieeeTerms: "ieee_terms",
  systemSettings: "system_settings",
  topBoardExclusions: "top_board_exclusions",
  auditLogs: "audit_logs",
  conclusionReports: "conclusion_reports",
  reportApprovals: "report_approvals",
  participationRecords: "participation_records",
  gradeRequests: "grade_requests",
  gradeReviews: "grade_reviews",
  pointLedger: "point_ledger",
  termScoringConfig: "term_scoring_config",
} as const;

export const UOM_VERIFICATION_CODE_TTL_MINUTES = 15;
export const UOM_VERIFICATION_MAX_ATTEMPTS = 5;
