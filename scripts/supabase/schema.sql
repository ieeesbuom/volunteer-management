-- ============================================================
-- VoluntIEEE - Supabase PostgreSQL Schema
-- Generated for full migration from Appwrite to Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Table: profiles (Profiles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "authUserId" TEXT NOT NULL,
  "googleEmail" TEXT NOT NULL,
  "name" TEXT,
  "uomEmail" TEXT,
  "uomVerified" BOOLEAN DEFAULT FALSE,
  "uomVerifiedAt" TIMESTAMPTZ,
  "status" TEXT DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMPTZ,
  "avatarFileId" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "profiles_google_email_idx" ON public.profiles ("googleEmail");
CREATE INDEX IF NOT EXISTS "profiles_uom_email_idx" ON public.profiles ("uomEmail");
CREATE INDEX IF NOT EXISTS "profiles_last_login_idx" ON public.profiles ("lastLoginAt");

-- ------------------------------------------------------------
-- Table: profile_details (Profile Details)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_details (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "universityIndex" TEXT,
  "faculty" TEXT,
  "department" TEXT,
  "batchYear" TEXT,
  "headline" TEXT,
  "bio" TEXT,
  "skills" TEXT,
  "linkedinUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "profile_details_user_idx" ON public.profile_details ("userId");

-- ------------------------------------------------------------
-- Table: recommendation_requests (Recommendation Requests)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendation_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "requesterId" TEXT NOT NULL,
  "respondentId" TEXT NOT NULL,
  "requestKey" TEXT,
  "message" TEXT,
  "status" TEXT DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "respondedAt" TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rec_req_requester_idx" ON public.recommendation_requests ("requesterId");
CREATE INDEX IF NOT EXISTS "rec_req_respondent_idx" ON public.recommendation_requests ("respondentId");
CREATE INDEX IF NOT EXISTS "rec_req_key_idx" ON public.recommendation_requests ("requestKey");
CREATE INDEX IF NOT EXISTS "rec_req_status_idx" ON public.recommendation_requests ("status");
CREATE INDEX IF NOT EXISTS "rec_req_key_status_idx" ON public.recommendation_requests ("requestKey", "status");
CREATE INDEX IF NOT EXISTS "rec_req_pair_status_idx" ON public.recommendation_requests ("requesterId", "respondentId", "status");
CREATE INDEX IF NOT EXISTS "rec_req_requester_created_idx" ON public.recommendation_requests ("requesterId", "createdAt");
CREATE INDEX IF NOT EXISTS "rec_req_respondent_created_idx" ON public.recommendation_requests ("respondentId", "createdAt");

-- ------------------------------------------------------------
-- Table: recommendations (Recommendations)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "requestId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "respondentId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" TEXT DEFAULT 'VISIBLE',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "hiddenAt" TIMESTAMPTZ,
  "hiddenBy" TEXT,
  "reportedAt" TIMESTAMPTZ,
  "reportedBy" TEXT,
  "reportReason" TEXT,
  "hideReason" TEXT
);

CREATE INDEX IF NOT EXISTS "recommendations_request_idx" ON public.recommendations ("requestId");
CREATE INDEX IF NOT EXISTS "recommendations_requester_idx" ON public.recommendations ("requesterId");
CREATE INDEX IF NOT EXISTS "recommendations_respondent_idx" ON public.recommendations ("respondentId");
CREATE INDEX IF NOT EXISTS "recommendations_status_idx" ON public.recommendations ("status");
CREATE INDEX IF NOT EXISTS "recs_req_status_created_idx" ON public.recommendations ("requesterId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "recommendations_status_created_idx" ON public.recommendations ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "recommendations_status_updated_idx" ON public.recommendations ("status", "updatedAt");

-- ------------------------------------------------------------
-- Table: uom_verification_requests (UoM Verification Requests)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uom_verification_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "uomEmail" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "attempts" BIGINT DEFAULT 0,
  "status" TEXT DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "uom_verification_user_idx" ON public.uom_verification_requests ("userId");
CREATE INDEX IF NOT EXISTS "uom_verification_status_idx" ON public.uom_verification_requests ("status");
CREATE INDEX IF NOT EXISTS "uom_verification_email_idx" ON public.uom_verification_requests ("uomEmail");
CREATE INDEX IF NOT EXISTS "uom_verification_user_status_idx" ON public.uom_verification_requests ("userId", "status");

-- ------------------------------------------------------------
-- Table: sb_role_assignments (SB Role Assignments)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sb_role_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "active" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sb_roles_user_idx" ON public.sb_role_assignments ("userId");
CREATE INDEX IF NOT EXISTS "sb_roles_role_idx" ON public.sb_role_assignments ("role");
CREATE INDEX IF NOT EXISTS "sb_roles_term_idx" ON public.sb_role_assignments ("term");
CREATE INDEX IF NOT EXISTS "sb_roles_active_idx" ON public.sb_role_assignments ("active");
CREATE INDEX IF NOT EXISTS "sb_roles_user_active_idx" ON public.sb_role_assignments ("userId", "active");

-- ------------------------------------------------------------
-- Table: event_role_assignments (Event Role Assignments)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_role_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventTitle" TEXT NOT NULL,
  "committeeName" TEXT,
  "role" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "active" BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "event_roles_user_idx" ON public.event_role_assignments ("userId");
CREATE INDEX IF NOT EXISTS "event_roles_event_idx" ON public.event_role_assignments ("eventId");
CREATE INDEX IF NOT EXISTS "event_roles_role_idx" ON public.event_role_assignments ("role");
CREATE INDEX IF NOT EXISTS "event_roles_active_idx" ON public.event_role_assignments ("active");
CREATE INDEX IF NOT EXISTS "event_roles_user_active_idx" ON public.event_role_assignments ("userId", "active");
CREATE INDEX IF NOT EXISTS "event_roles_user_event_active_idx" ON public.event_role_assignments ("userId", "eventId", "active");
CREATE INDEX IF NOT EXISTS "event_roles_event_active_time_idx" ON public.event_role_assignments ("eventId", "active", "assignedAt");
CREATE INDEX IF NOT EXISTS "event_roles_event_role_active_idx" ON public.event_role_assignments ("eventId", "role", "active");
CREATE INDEX IF NOT EXISTS "event_roles_lookup_idx" ON public.event_role_assignments ("userId", "eventId", "role", "committeeName", "active");

-- ------------------------------------------------------------
-- Table: ieee_terms (IEEE Terms)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ieee_terms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "label" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "active" BOOLEAN DEFAULT FALSE,
  "status" TEXT DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "ieee_terms_label_idx" ON public.ieee_terms ("label");
CREATE UNIQUE INDEX IF NOT EXISTS "ieee_terms_label_unique" ON public.ieee_terms ("label");
CREATE UNIQUE INDEX IF NOT EXISTS "ieee_terms_date_range_unique" ON public.ieee_terms ("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "ieee_terms_active_idx" ON public.ieee_terms ("active");
CREATE INDEX IF NOT EXISTS "ieee_terms_status_idx" ON public.ieee_terms ("status");
CREATE INDEX IF NOT EXISTS "ieee_terms_start_idx" ON public.ieee_terms ("startDate");
CREATE INDEX IF NOT EXISTS "ieee_terms_end_idx" ON public.ieee_terms ("endDate");

-- ------------------------------------------------------------
-- Table: system_settings (System Settings)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "updatedBy" TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "system_settings_key_idx" ON public.system_settings ("key");

-- ------------------------------------------------------------
-- Table: top_board_exclusions (Top Board Exclusions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.top_board_exclusions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "termId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "active" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "createdBy" TEXT NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "revokedBy" TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "top_board_exclusions_term_idx" ON public.top_board_exclusions ("termId");
CREATE INDEX IF NOT EXISTS "top_board_exclusions_user_idx" ON public.top_board_exclusions ("userId");
CREATE INDEX IF NOT EXISTS "top_board_exclusions_active_idx" ON public.top_board_exclusions ("active");
CREATE INDEX IF NOT EXISTS "top_board_term_created_idx" ON public.top_board_exclusions ("termId", "createdAt");
CREATE INDEX IF NOT EXISTS "top_board_exclusions_term_active_idx" ON public.top_board_exclusions ("termId", "active");

-- ------------------------------------------------------------
-- Table: audit_logs (Audit Logs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_target_idx" ON public.audit_logs ("targetId");
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON public.audit_logs ("actorUserId");
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON public.audit_logs ("action");
CREATE INDEX IF NOT EXISTS "audit_created_at_idx" ON public.audit_logs ("createdAt");
CREATE INDEX IF NOT EXISTS "audit_action_created_idx" ON public.audit_logs ("action", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_actor_created_idx" ON public.audit_logs ("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_target_created_idx" ON public.audit_logs ("targetId", "createdAt");

-- ------------------------------------------------------------
-- Table: conclusion_reports (Conclusion Reports)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conclusion_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL,
  "eventTitle" TEXT NOT NULL,
  "status" TEXT DEFAULT 'DRAFT',
  "content" TEXT NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "submittedByName" TEXT NOT NULL,
  "submittedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "conclusion_reports_event_idx" ON public.conclusion_reports ("eventId");
CREATE INDEX IF NOT EXISTS "conclusion_reports_status_idx" ON public.conclusion_reports ("status");
CREATE INDEX IF NOT EXISTS "conclusion_reports_submitted_by_idx" ON public.conclusion_reports ("submittedBy");
CREATE INDEX IF NOT EXISTS "conclusion_reports_updated_at_idx" ON public.conclusion_reports ("updatedAt");
CREATE INDEX IF NOT EXISTS "conclusion_reports_event_status_idx" ON public.conclusion_reports ("eventId", "status");
CREATE INDEX IF NOT EXISTS "conclusion_status_updated_idx" ON public.conclusion_reports ("status", "updatedAt");

-- ------------------------------------------------------------
-- Table: report_approvals (Report Approvals)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_approvals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "reportId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reviewedBy" TEXT NOT NULL,
  "reviewedByName" TEXT NOT NULL,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "report_approvals_report_idx" ON public.report_approvals ("reportId");
CREATE INDEX IF NOT EXISTS "report_approvals_status_idx" ON public.report_approvals ("status");
CREATE INDEX IF NOT EXISTS "report_approvals_reviewed_by_idx" ON public.report_approvals ("reviewedBy");
CREATE INDEX IF NOT EXISTS "report_approvals_reviewed_at_idx" ON public.report_approvals ("reviewedAt");
CREATE INDEX IF NOT EXISTS "report_appr_report_status_time_idx" ON public.report_approvals ("reportId", "status", "reviewedAt");

-- ------------------------------------------------------------
-- Table: participation_records (Participation Records)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.participation_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "participation_user_idx" ON public.participation_records ("userId");
CREATE INDEX IF NOT EXISTS "participation_event_idx" ON public.participation_records ("eventId");
CREATE INDEX IF NOT EXISTS "participation_event_status_idx" ON public.participation_records ("eventId", "status");
CREATE INDEX IF NOT EXISTS "participation_user_event_status_idx" ON public.participation_records ("userId", "eventId", "status");

-- ------------------------------------------------------------
-- Table: grade_requests (Grade Requests)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grade_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "requestId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "grade_requests_event_idx" ON public.grade_requests ("eventId");
CREATE INDEX IF NOT EXISTS "grade_requests_target_idx" ON public.grade_requests ("targetUserId");
CREATE INDEX IF NOT EXISTS "grade_requests_updated_idx" ON public.grade_requests ("updatedAt");
CREATE INDEX IF NOT EXISTS "grade_requests_target_updated_idx" ON public.grade_requests ("targetUserId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "grade_requests_event_target_idx" ON public.grade_requests ("eventId", "targetUserId");

-- ------------------------------------------------------------
-- Table: grade_reviews (Grade Reviews)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grade_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "gradeRequestId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "gradeValue" BIGINT NOT NULL,
  "submittedAt" TIMESTAMPTZ NOT NULL,
  "audit_metadata" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "grade_reviews_request_idx" ON public.grade_reviews ("gradeRequestId");
CREATE INDEX IF NOT EXISTS "grade_reviews_reviewer_idx" ON public.grade_reviews ("reviewerId");
CREATE INDEX IF NOT EXISTS "grade_reviews_submitted_idx" ON public.grade_reviews ("submittedAt");

-- ------------------------------------------------------------
-- Table: point_ledger (Point Ledger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_ledger (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "points" BIGINT NOT NULL,
  "conclusionApprovalDate" TIMESTAMPTZ NOT NULL,
  "term" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "point_ledger_user_idx" ON public.point_ledger ("userId");
CREATE INDEX IF NOT EXISTS "point_ledger_event_idx" ON public.point_ledger ("eventId");
CREATE INDEX IF NOT EXISTS "point_ledger_approval_idx" ON public.point_ledger ("conclusionApprovalDate");
CREATE INDEX IF NOT EXISTS "point_ledger_term_idx" ON public.point_ledger ("term");
CREATE INDEX IF NOT EXISTS "point_ledger_user_event_idx" ON public.point_ledger ("userId", "eventId");
CREATE INDEX IF NOT EXISTS "point_ledger_user_event_source_idx" ON public.point_ledger ("userId", "eventId", "source");
CREATE INDEX IF NOT EXISTS "point_ledger_term_approval_idx" ON public.point_ledger ("term", "conclusionApprovalDate");

-- ------------------------------------------------------------
-- Table: recognition_snapshots (Recognition Snapshots)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recognition_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "snapshotKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "term" TEXT,
  "year" BIGINT,
  "month" BIGINT,
  "payload" TEXT NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL,
  "generatedBy" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "recognition_snapshots_key_idx" ON public.recognition_snapshots ("snapshotKey");
CREATE INDEX IF NOT EXISTS "recognition_snapshots_kind_idx" ON public.recognition_snapshots ("kind");
CREATE INDEX IF NOT EXISTS "recognition_snapshots_time_idx" ON public.recognition_snapshots ("generatedAt");

-- ------------------------------------------------------------
-- Table: term_scoring_config (Term Scoring Config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.term_scoring_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "year" BIGINT NOT NULL,
  "excludedFromTopBoard" BOOLEAN DEFAULT FALSE,
  "reason" TEXT,
  "setBy" TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "term_config_user_idx" ON public.term_scoring_config ("userId");
CREATE INDEX IF NOT EXISTS "term_config_lookup_idx" ON public.term_scoring_config ("term", "year");
CREATE INDEX IF NOT EXISTS "term_config_user_term_year_idx" ON public.term_scoring_config ("userId", "term", "year");

-- ------------------------------------------------------------
-- Table: events (Events)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT,
  "term" TEXT NOT NULL,
  "year" BIGINT NOT NULL,
  "start_date" TIMESTAMPTZ NOT NULL,
  "end_date" TIMESTAMPTZ,
  "status" TEXT NOT NULL,
  "conclusion_status" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "events_status_idx" ON public.events ("status");
CREATE INDEX IF NOT EXISTS "events_term_idx" ON public.events ("term");
CREATE INDEX IF NOT EXISTS "events_created_by_idx" ON public.events ("created_by");
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON public.events ("created_at");
CREATE INDEX IF NOT EXISTS "events_status_created_idx" ON public.events ("status", "created_at");
CREATE INDEX IF NOT EXISTS "events_term_created_idx" ON public.events ("term", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "events_reference_idx" ON public.events ("reference");

-- ------------------------------------------------------------
-- Table: event_committees (Event Committees)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_committees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "event_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "event_committees_event_idx" ON public.event_committees ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_committees_event_name_idx" ON public.event_committees ("event_id", "name");

-- ------------------------------------------------------------
-- Table: event_committee_members (Event Committee Members)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_committee_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "committee_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "added_by" TEXT NOT NULL,
  "added_at" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "event_members_committee_idx" ON public.event_committee_members ("committee_id");
CREATE INDEX IF NOT EXISTS "event_members_user_idx" ON public.event_committee_members ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_members_committee_user_idx" ON public.event_committee_members ("committee_id", "user_id");

-- ------------------------------------------------------------
-- Table: notifications (Notifications)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipientUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "linkHref" TEXT,
  "actorUserId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "metadata" TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON public.notifications ("recipientUserId");
CREATE INDEX IF NOT EXISTS "notifications_recipient_read_idx" ON public.notifications ("recipientUserId", "readAt");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON public.notifications ("createdAt");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON public.notifications ("type");
CREATE INDEX IF NOT EXISTS "notifications_recipient_created_idx" ON public.notifications ("recipientUserId", "createdAt");

-- ------------------------------------------------------------
-- Table: notification_preferences (Notification Preferences)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN DEFAULT FALSE,
  "inAppEnabled" BOOLEAN DEFAULT TRUE,
  "typePreferences" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_preferences_user_idx" ON public.notification_preferences ("userId");

-- ------------------------------------------------------------
-- Table: form_connections (Form Connections)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.form_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "externalFormId" TEXT,
  "formUrl" TEXT,
  "purpose" TEXT NOT NULL,
  "status" TEXT DEFAULT 'active',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "form_connections_event_idx" ON public.form_connections ("eventId");
CREATE INDEX IF NOT EXISTS "form_connections_provider_status_idx" ON public.form_connections ("provider", "status");
CREATE INDEX IF NOT EXISTS "form_connections_status_idx" ON public.form_connections ("status");
CREATE INDEX IF NOT EXISTS "form_connections_event_updated_idx" ON public.form_connections ("eventId", "updatedAt");

-- ------------------------------------------------------------
-- Table: lava_forms (Lava Forms)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lava_forms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL,
  "connectionId" TEXT,
  "createdBy" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "openAt" TEXT,
  "closeAt" TEXT,
  "successMessage" TEXT,
  "confirmationEmailEnabled" BOOLEAN NOT NULL,
  "confirmationEmailTemplate" TEXT,
  "confirmationEmailFieldId" TEXT,
  "confirmationNameFieldId" TEXT,
  "confirmationEmailSelectedFieldIds" TEXT,
  "googleSheetsSyncEnabled" BOOLEAN NOT NULL,
  "googleSheetsSelectedFieldIds" TEXT,
  "googleSheetsAdminUserId" TEXT,
  "googleSheetsSheetTitle" TEXT,
  "teamMinMembers" BIGINT NOT NULL,
  "teamMaxMembers" BIGINT NOT NULL,
  "bannerFileId" TEXT,
  "sortOrder" BIGINT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "lava_forms_event_idx" ON public.lava_forms ("eventId");
CREATE INDEX IF NOT EXISTS "lava_forms_connection_idx" ON public.lava_forms ("connectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "lava_forms_event_slug_idx" ON public.lava_forms ("eventId", "slug");

-- ------------------------------------------------------------
-- Table: lava_form_fields (Lava Form Fields)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lava_form_fields (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "formId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL,
  "sortOrder" BIGINT NOT NULL,
  "optionsJson" TEXT,
  "placeholder" TEXT,
  "helpText" TEXT,
  "isUnique" BOOLEAN NOT NULL,
  "uniqueCaseSensitive" BOOLEAN NOT NULL,
  "validationPattern" TEXT,
  "validationPatternMessage" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lava_form_fields_form_idx" ON public.lava_form_fields ("formId");
CREATE INDEX IF NOT EXISTS "lava_form_fields_form_sort_idx" ON public.lava_form_fields ("formId", "sortOrder");

-- ------------------------------------------------------------
-- Table: lava_form_submissions (Lava Form Submissions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lava_form_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "formId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "answersJson" TEXT NOT NULL,
  "memberAnswersJson" TEXT,
  "teamName" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lava_form_submissions_form_idx" ON public.lava_form_submissions ("formId");
CREATE INDEX IF NOT EXISTS "lava_submissions_created_idx" ON public.lava_form_submissions ("formId", "createdAt");
CREATE INDEX IF NOT EXISTS "lava_submissions_submitter_idx" ON public.lava_form_submissions ("submittedBy");

-- ------------------------------------------------------------
-- Table: lava_form_unique_keys (Lava Form Unique Keys)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lava_form_unique_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "uniqueKey" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "submissionId" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "lava_form_unique_keys_key_idx" ON public.lava_form_unique_keys ("uniqueKey");
CREATE INDEX IF NOT EXISTS "lava_form_unique_keys_form_idx" ON public.lava_form_unique_keys ("formId");
CREATE INDEX IF NOT EXISTS "lava_form_unique_keys_submission_idx" ON public.lava_form_unique_keys ("submissionId");

-- ============================================================
-- Supabase Storage Buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('profile_avatars', 'profile_avatars', true),
  ('conclusion_report_files', 'conclusion_report_files', false),
  ('lava_form_files', 'lava_form_files', false)
ON CONFLICT (id) DO NOTHING;

-- Public read access for profile_avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Read Access for Avatars'
  ) THEN
    CREATE POLICY "Public Read Access for Avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile_avatars');
  END IF;
END $$;
