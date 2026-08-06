import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

process.env.FORCE_NODE_FETCH ??= "1";

const envFiles = [".env.local", ".env"];

for (const envFile of envFiles) {
  const envPath = path.join(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    continue;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...valueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = valueParts.join("=").trim();

    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

const requiredEnv = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "NEXT_PUBLIC_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env values: ${missing.join(", ")}`);
  process.exit(1);
}

const { Client, Databases, Query, TablesDB, TablesDBIndexType } = await import("node-appwrite");

const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_SETUP_API_KEY || process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const tables = new TablesDB(client);
const eventRoleElements = [
  "Chair",
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
];
const legacyEventRoleElements = ["Lead", "OC Member"];

function recommendationRequestKey(requesterId, respondentId) {
  return `rk_${createHash("sha1").update(`${requesterId}:${respondentId}`).digest("hex")}`;
}
const notificationTypeElements = [
  "verification",
  "role_assignment",
  "event_update",
  "grading_request",
  "report_approval",
  "system",
];
const formProviderElements = ["google_forms", "external_form_builder", "other"];
const formPurposeElements = [
  "registration",
  "feedback",
  "attendance",
  "grading",
  "other",
];
const formStatusElements = ["active", "disabled", "archived"];

const tableDefinitions = [
  {
    id: "profiles",
    name: "Profiles",
    columns: [
      ["string", "authUserId", 64, true],
      ["email", "googleEmail", true],
      ["string", "name", 128, false],
      ["email", "uomEmail", false],
      ["boolean", "uomVerified", false, false],
      ["datetime", "uomVerifiedAt", false],
      ["enum", "status", ["ACTIVE", "DISABLED"], false, "ACTIVE"],
      ["datetime", "lastLoginAt", false],
    ],
    indexes: [
      ["profiles_google_email_idx", ["googleEmail"]],
      ["profiles_uom_email_idx", ["uomEmail"]],
      ["profiles_last_login_idx", ["lastLoginAt"]],
    ],
  },
  {
    id: "profile_details",
    name: "Profile Details",
    columns: [
      ["string", "userId", 64, true],
      ["string", "universityIndex", 40, false],
      ["string", "faculty", 120, false],
      ["string", "department", 120, false],
      ["string", "batchYear", 40, false],
      ["string", "headline", 160, false],
      ["string", "bio", 1200, false],
      ["string", "skills", 500, false],
      ["string", "linkedinUrl", 240, false],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
    ],
    indexes: [["profile_details_user_idx", ["userId"]]],
  },
  {
    id: "recommendation_requests",
    name: "Recommendation Requests",
    columns: [
      ["string", "requesterId", 64, true],
      ["string", "respondentId", 64, true],
      ["string", "requestKey", 128, false],
      ["string", "message", 500, false],
      ["enum", "status", ["PENDING", "ACCEPTED", "REJECTED"], false, "PENDING"],
      ["datetime", "createdAt", true],
      ["datetime", "respondedAt", false],
    ],
    indexes: [
      ["rec_req_requester_idx", ["requesterId"]],
      ["rec_req_respondent_idx", ["respondentId"]],
      ["rec_req_key_idx", ["requestKey"]],
      ["rec_req_status_idx", ["status"]],
      ["rec_req_key_status_idx", ["requestKey", "status"]],
      ["rec_req_pair_status_idx", ["requesterId", "respondentId", "status"]],
      ["rec_req_requester_created_idx", ["requesterId", "createdAt"]],
      ["rec_req_respondent_created_idx", ["respondentId", "createdAt"]],
    ],
  },
  {
    id: "recommendations",
    name: "Recommendations",
    columns: [
      ["string", "requestId", 64, true],
      ["string", "requesterId", 64, true],
      ["string", "respondentId", 64, true],
      ["string", "text", 2000, true],
      ["enum", "status", ["VISIBLE", "HIDDEN", "REPORTED"], false, "VISIBLE"],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
      ["datetime", "hiddenAt", false],
      ["string", "hiddenBy", 64, false],
      ["datetime", "reportedAt", false],
      ["string", "reportedBy", 64, false],
      ["string", "reportReason", 500, false],
      ["string", "hideReason", 500, false],
    ],
    indexes: [
      ["recommendations_request_idx", ["requestId"]],
      ["recommendations_requester_idx", ["requesterId"]],
      ["recommendations_respondent_idx", ["respondentId"]],
      ["recommendations_status_idx", ["status"]],
      ["recs_req_status_created_idx", ["requesterId", "status", "createdAt"]],
      ["recommendations_status_created_idx", ["status", "createdAt"]],
      ["recommendations_status_updated_idx", ["status", "updatedAt"]],
    ],
  },
  {
    id: "uom_verification_requests",
    name: "UoM Verification Requests",
    columns: [
      ["string", "userId", 64, true],
      ["email", "uomEmail", true],
      ["string", "codeHash", 128, true],
      ["datetime", "expiresAt", true],
      ["integer", "attempts", false, 0],
      ["enum", "status", ["PENDING", "VERIFIED", "EXPIRED", "CANCELLED"], false, "PENDING"],
      ["datetime", "verifiedAt", false],
    ],
    indexes: [
      ["uom_verification_user_idx", ["userId"]],
      ["uom_verification_status_idx", ["status"]],
      ["uom_verification_email_idx", ["uomEmail"]],
      ["uom_verification_user_status_idx", ["userId", "status"]],
    ],
  },
  {
    id: "sb_role_assignments",
    name: "SB Role Assignments",
    columns: [
      ["string", "userId", 64, true],
      ["enum", "role", ["Chairperson", "Vice Chairperson", "Secretary", "Assistant Secretary", "Treasurer", "Assistant Treasurer", "Editor", "Webmaster", "SB Lead", "SB Member"], true],
      ["string", "term", 32, true],
      ["string", "assignedBy", 64, true],
      ["datetime", "assignedAt", true],
      ["datetime", "revokedAt", false],
      ["boolean", "active", false, true],
    ],
    indexes: [
      ["sb_roles_user_idx", ["userId"]],
      ["sb_roles_role_idx", ["role"]],
      ["sb_roles_term_idx", ["term"]],
      ["sb_roles_active_idx", ["active"]],
      ["sb_roles_user_active_idx", ["userId", "active"]],
    ],
  },
  {
    id: "event_role_assignments",
    name: "Event Role Assignments",
    columns: [
      ["string", "userId", 64, true],
      ["string", "eventId", 128, true],
      ["string", "eventTitle", 160, true],
      ["string", "committeeName", 120, false],
      ["enum", "role", eventRoleElements, true],
      ["string", "assignedBy", 64, true],
      ["datetime", "assignedAt", true],
      ["datetime", "revokedAt", false],
      ["boolean", "active", false, true],
    ],
    indexes: [
      ["event_roles_user_idx", ["userId"]],
      ["event_roles_event_idx", ["eventId"]],
      ["event_roles_role_idx", ["role"]],
      ["event_roles_active_idx", ["active"]],
      ["event_roles_user_active_idx", ["userId", "active"]],
      ["event_roles_user_event_active_idx", ["userId", "eventId", "active"]],
      ["event_roles_event_active_time_idx", ["eventId", "active", "assignedAt"]],
      ["event_roles_event_role_active_idx", ["eventId", "role", "active"]],
      [
        "event_roles_lookup_idx",
        ["userId", "eventId", "role", "committeeName", "active"],
      ],
    ],
  },
  {
    id: "ieee_terms",
    name: "IEEE Terms",
    columns: [
      ["string", "label", 32, true],
      ["string", "startDate", 10, true],
      ["string", "endDate", 10, true],
      ["boolean", "active", false, false],
      ["enum", "status", ["DRAFT", "ACTIVE", "CLOSED"], false, "DRAFT"],
      ["string", "notes", 1000, false],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
      ["string", "createdBy", 64, true],
      ["string", "updatedBy", 64, true],
    ],
    indexes: [
      ["ieee_terms_label_idx", ["label"]],
      ["ieee_terms_label_unique", ["label"], TablesDBIndexType.Unique],
      [
        "ieee_terms_date_range_unique",
        ["startDate", "endDate"],
        TablesDBIndexType.Unique,
      ],
      ["ieee_terms_active_idx", ["active"]],
      ["ieee_terms_status_idx", ["status"]],
      ["ieee_terms_start_idx", ["startDate"]],
      ["ieee_terms_end_idx", ["endDate"]],
    ],
  },
  {
    id: "system_settings",
    name: "System Settings",
    columns: [
      ["string", "key", 128, true],
      ["string", "value", 4000, false],
      ["datetime", "updatedAt", true],
      ["string", "updatedBy", 64, true],
    ],
    indexes: [
      ["system_settings_key_idx", ["key"]],
    ],
  },
  {
    id: "top_board_exclusions",
    name: "Top Board Exclusions",
    columns: [
      ["string", "termId", 64, true],
      ["string", "userId", 64, true],
      ["string", "reason", 1000, true],
      ["boolean", "active", false, true],
      ["datetime", "createdAt", true],
      ["string", "createdBy", 64, true],
      ["datetime", "revokedAt", false],
      ["string", "revokedBy", 64, false],
    ],
    indexes: [
      ["top_board_exclusions_term_idx", ["termId"]],
      ["top_board_exclusions_user_idx", ["userId"]],
      ["top_board_exclusions_active_idx", ["active"]],
      ["top_board_term_created_idx", ["termId", "createdAt"]],
      ["top_board_exclusions_term_active_idx", ["termId", "active"]],
    ],
  },
  {
    id: "audit_logs",
    name: "Audit Logs",
    columns: [
      ["string", "actorUserId", 64, false],
      ["string", "action", 64, true],
      ["string", "targetType", 64, true],
      ["string", "targetId", 128, true],
      ["string", "metadata", 4000, false],
      ["datetime", "createdAt", true],
    ],
    indexes: [
      ["audit_target_idx", ["targetId"]],
      ["audit_actor_idx", ["actorUserId"]],
      ["audit_action_idx", ["action"]],
      ["audit_created_at_idx", ["createdAt"]],
      ["audit_action_created_idx", ["action", "createdAt"]],
      ["audit_actor_created_idx", ["actorUserId", "createdAt"]],
      ["audit_target_created_idx", ["targetId", "createdAt"]],
    ],
  },
  {
    id: "conclusion_reports",
    name: "Conclusion Reports",
    columns: [
      ["string", "eventId", 128, true],
      ["string", "eventTitle", 160, true],
      ["enum", "status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"], false, "DRAFT"],
      ["string", "content", 12000, true],
      ["string", "submittedBy", 64, true],
      ["string", "submittedByName", 128, true],
      ["datetime", "submittedAt", false],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
    ],
    indexes: [
      ["conclusion_reports_event_idx", ["eventId"]],
      ["conclusion_reports_status_idx", ["status"]],
      ["conclusion_reports_submitted_by_idx", ["submittedBy"]],
      ["conclusion_reports_updated_at_idx", ["updatedAt"]],
      ["conclusion_reports_event_status_idx", ["eventId", "status"]],
      ["conclusion_status_updated_idx", ["status", "updatedAt"]],
    ],
  },
  {
    id: "report_approvals",
    name: "Report Approvals",
    columns: [
      ["string", "reportId", 64, true],
      ["enum", "status", ["APPROVED", "REJECTED"], true],
      ["string", "reviewedBy", 64, true],
      ["string", "reviewedByName", 128, true],
      ["string", "reviewNote", 1000, false],
      ["datetime", "reviewedAt", true],
    ],
    indexes: [
      ["report_approvals_report_idx", ["reportId"]],
      ["report_approvals_status_idx", ["status"]],
      ["report_approvals_reviewed_by_idx", ["reviewedBy"]],
      ["report_approvals_reviewed_at_idx", ["reviewedAt"]],
      ["report_appr_report_status_time_idx", ["reportId", "status", "reviewedAt"]],
    ],
  },
  {
    id: "participation_records",
    name: "Participation Records",
    columns: [
      ["string", "userId", 64, true],
      ["string", "eventId", 128, true],
      ["string", "role", 64, true],
      ["enum", "status", ["attended", "absent", "excused"], true],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
    ],
    indexes: [
      ["participation_user_idx", ["userId"]],
      ["participation_event_idx", ["eventId"]],
      ["participation_event_status_idx", ["eventId", "status"]],
      ["participation_user_event_status_idx", ["userId", "eventId", "status"]],
    ],
  },
  {
    id: "grade_requests",
    name: "Grade Requests",
    columns: [
      ["string", "requestId", 64, true],
      ["string", "eventId", 128, true],
      ["string", "requestedBy", 64, true],
      ["string", "targetUserId", 64, true],
      ["enum", "status", ["pending", "submitted", "reviewed", "finalized"], true],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
    ],
    indexes: [
      ["grade_requests_event_idx", ["eventId"]],
      ["grade_requests_target_idx", ["targetUserId"]],
      ["grade_requests_updated_idx", ["updatedAt"]],
      ["grade_requests_target_updated_idx", ["targetUserId", "updatedAt"]],
    ],
  },
  {
    id: "grade_reviews",
    name: "Grade Reviews",
    columns: [
      ["string", "gradeRequestId", 64, true],
      ["string", "reviewerId", 64, true],
      ["integer", "gradeValue", true],
      ["datetime", "submittedAt", true],
      ["string", "audit_metadata", 4000, false],
    ],
    indexes: [
      ["grade_reviews_request_idx", ["gradeRequestId"]],
      ["grade_reviews_reviewer_idx", ["reviewerId"]],
      ["grade_reviews_submitted_idx", ["submittedAt"]],
    ],
  },
  {
    id: "point_ledger",
    name: "Point Ledger",
    columns: [
      ["string", "userId", 64, true],
      ["string", "eventId", 128, true],
      ["integer", "points", true],
      ["datetime", "conclusionApprovalDate", true],
      ["string", "term", 32, true],
      ["enum", "source", ["grade", "role", "manual"], true],
      ["string", "createdBy", 64, true],
      ["datetime", "createdAt", true],
    ],
    indexes: [
      ["point_ledger_user_idx", ["userId"]],
      ["point_ledger_event_idx", ["eventId"]],
      ["point_ledger_approval_idx", ["conclusionApprovalDate"]],
      ["point_ledger_term_idx", ["term"]],
      ["point_ledger_user_event_idx", ["userId", "eventId"]],
      ["point_ledger_user_event_source_idx", ["userId", "eventId", "source"]],
      ["point_ledger_term_approval_idx", ["term", "conclusionApprovalDate"]],
    ],
  },
  {
    id: "recognition_snapshots",
    name: "Recognition Snapshots",
    columns: [
      ["string", "snapshotKey", 128, true],
      ["enum", "kind", ["recognition"], true],
      ["string", "term", 32, false],
      ["integer", "year", false],
      ["integer", "month", false],
      ["string", "payload", 12000, true],
      ["datetime", "generatedAt", true],
      ["string", "generatedBy", 64, false],
    ],
    indexes: [
      ["recognition_snapshots_key_idx", ["snapshotKey"], "unique"],
      ["recognition_snapshots_kind_idx", ["kind"]],
      ["recognition_snapshots_time_idx", ["generatedAt"]],
    ],
  },
  {
    id: "term_scoring_config",
    name: "Term Scoring Config",
    columns: [
      ["string", "userId", 64, true],
      ["string", "term", 32, true],
      ["integer", "year", true],
      ["boolean", "excludedFromTopBoard", false, false],
      ["string", "reason", 500, false],
      ["string", "setBy", 64, true],
    ],
    indexes: [
      ["term_config_user_idx", ["userId"]],
      ["term_config_lookup_idx", ["term", "year"]],
      ["term_config_user_term_year_idx", ["userId", "term", "year"]],
    ],
  },
  {
    id: "events",
    name: "Events",
    columns: [
      ["string", "title", 200, true],
      ["string", "reference", 100, true],
      ["string", "description", 2000, false],
      ["string", "term", 20, true],
      ["integer", "year", true],
      ["datetime", "start_date", true],
      ["datetime", "end_date", false],
      [
        "enum",
        "status",
        ["draft", "planning", "published", "ongoing", "pending_conclusion", "closed"],
        true,
      ],
      [
        "enum",
        "conclusion_status",
        ["not_submitted", "submitted", "approved", "rejected"],
        true,
      ],
      ["string", "created_by", 64, true],
      ["datetime", "created_at", true],
      ["datetime", "updated_at", true],
    ],
    indexes: [
      ["events_status_idx", ["status"]],
      ["events_term_idx", ["term"]],
      ["events_created_by_idx", ["created_by"]],
      ["events_created_at_idx", ["created_at"]],
      ["events_status_created_idx", ["status", "created_at"]],
      ["events_term_created_idx", ["term", "created_at"]],
      ["events_reference_idx", ["reference"], "unique"],
    ],
  },
  {
    id: "event_committees",
    name: "Event Committees",
    columns: [
      ["string", "event_id", 64, true],
      ["string", "name", 100, true],
      ["string", "description", 500, false],
      ["datetime", "created_at", true],
      ["datetime", "updated_at", true],
    ],
    indexes: [
      ["event_committees_event_idx", ["event_id"]],
      ["event_committees_event_name_idx", ["event_id", "name"], "unique"],
    ],
  },
  {
    id: "event_committee_members",
    name: "Event Committee Members",
    columns: [
      ["string", "committee_id", 64, true],
      ["string", "user_id", 64, true],
      ["string", "added_by", 64, true],
      ["datetime", "added_at", true],
    ],
    indexes: [
      ["event_members_committee_idx", ["committee_id"]],
      ["event_members_user_idx", ["user_id"]],
      ["event_members_committee_user_idx", ["committee_id", "user_id"], "unique"],
    ],
  },
  {
    id: "notifications",
    name: "Notifications",
    columns: [
      ["string", "recipientUserId", 64, true],
      ["enum", "type", notificationTypeElements, true],
      ["string", "title", 160, true],
      ["string", "message", 1000, true],
      ["string", "linkHref", 512, false],
      ["string", "actorUserId", 64, false],
      ["string", "entityType", 64, false],
      ["string", "entityId", 128, false],
      ["datetime", "readAt", false],
      ["datetime", "createdAt", true],
      ["string", "metadata", 4000, false],
    ],
    indexes: [
      ["notifications_recipient_idx", ["recipientUserId"]],
      ["notifications_recipient_read_idx", ["recipientUserId", "readAt"]],
      ["notifications_created_at_idx", ["createdAt"]],
      ["notifications_type_idx", ["type"]],
      ["notifications_recipient_created_idx", ["recipientUserId", "createdAt"]],
    ],
  },
  {
    id: "notification_preferences",
    name: "Notification Preferences",
    columns: [
      ["string", "userId", 64, true],
      ["boolean", "emailEnabled", false, false],
      ["boolean", "inAppEnabled", false, true],
      ["string", "typePreferences", 4000, false],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
    ],
    indexes: [
      ["notification_preferences_user_idx", ["userId"]],
    ],
  },
  {
    id: "form_connections",
    name: "Form Connections",
    columns: [
      ["string", "eventId", 128, true],
      ["enum", "provider", formProviderElements, true],
      ["string", "title", 160, true],
      ["string", "externalFormId", 256, false],
      ["string", "formUrl", 1024, false],
      ["enum", "purpose", formPurposeElements, true],
      ["enum", "status", formStatusElements, false, "active"],
      ["string", "createdBy", 64, true],
      ["datetime", "createdAt", true],
      ["datetime", "updatedAt", true],
      ["string", "metadata", 4000, false],
    ],
    indexes: [
      ["form_connections_event_idx", ["eventId"]],
      ["form_connections_provider_status_idx", ["provider", "status"]],
      ["form_connections_status_idx", ["status"]],
      ["form_connections_event_updated_idx", ["eventId", "updatedAt"]],
    ],
  },
];

async function ignoreAlreadyExists(action, label) {
  try {
    await action();
    console.log(`created ${label}`);
  } catch (error) {
    if (error?.code === 409) {
      console.log(`exists ${label}`);
      return;
    }

    throw error;
  }
}

async function ensureDatabase() {
  try {
    await databases.get(databaseId);
    console.log(`exists database ${databaseId}`);
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }

    await databases.create(databaseId, "Volunteer Management");
    console.log(`created database ${databaseId}`);
  }
}

async function deleteColumnIfExists(tableId, key) {
  try {
    const table = await tables.getTable(databaseId, tableId);
    const existing = table.columns.some((column) => column.key === key);

    if (!existing) {
      return;
    }

    await tables.deleteColumn(databaseId, tableId, key);
    console.log(`deleted legacy column ${tableId}.${key}`);
    await waitForColumns(tableId);
  } catch (error) {
    if (error?.code === 404) {
      return;
    }

    throw error;
  }
}

async function migrateConclusionReportSchema(tableId) {
  if (tableId !== "conclusion_reports") {
    return;
  }

  for (const key of [
    "objectives",
    "outcomes",
    "challenges",
    "recommendations",
    "attendanceNotes",
  ]) {
    await deleteColumnIfExists(tableId, key);
  }
}

async function createColumn(tableId, column) {
  const [kind, key, ...rest] = column;
  const label = `${tableId}.${key}`;
  const table = await tables.getTable(databaseId, tableId);
  const existingColumn = table.columns.find((existing) => existing.key === key);

  if (kind === "enum") {
    const [elements, required, defaultValue] = rest;
    const existingElements =
      tableId === "event_role_assignments" && key === "role"
        ? [...new Set([...elements, ...legacyEventRoleElements])]
        : elements;

    try {
      await tables.createEnumColumn(
        databaseId,
        tableId,
        key,
        elements,
        required,
        defaultValue,
      );
      console.log(`created column ${label}`);
    } catch (error) {
      if (error?.code !== 409) {
        throw error;
      }

      await tables.updateEnumColumn(
        databaseId,
        tableId,
        key,
        existingElements,
        required,
        defaultValue ?? null,
      );
      console.log(`updated column ${label}`);
    }

    return;
  }

  if (existingColumn) {
    console.log(`exists column ${label}`);
    return;
  }

  await ignoreAlreadyExists(async () => {
    if (kind === "string") {
      const [size, required] = rest;
      await tables.createStringColumn(databaseId, tableId, key, size, required);
      return;
    }

    if (kind === "email") {
      const [required] = rest;
      await tables.createEmailColumn(databaseId, tableId, key, required);
      return;
    }

    if (kind === "boolean") {
      const [required, defaultValue] = rest;
      await tables.createBooleanColumn(databaseId, tableId, key, required, defaultValue);
      return;
    }

    if (kind === "datetime") {
      const [required] = rest;
      await tables.createDatetimeColumn(databaseId, tableId, key, required);
      return;
    }

    if (kind === "integer") {
      const [required, defaultValue] = rest;
      await tables.createIntegerColumn(
        databaseId,
        tableId,
        key,
        required,
        undefined,
        undefined,
        defaultValue,
      );
      return;
    }

    throw new Error(`Unsupported column type: ${kind}`);
  }, `column ${label}`);
}

async function waitForColumns(tableId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const table = await tables.getTable(databaseId, tableId);
    const processing = table.columns.filter((column) => column.status === "processing");

    if (processing.length === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function main() {
  await ensureDatabase();

  for (const table of tableDefinitions) {
    await ignoreAlreadyExists(
      () => tables.createTable(databaseId, table.id, table.name, [], false, true),
      `table ${table.id}`,
    );

    await migrateConclusionReportSchema(table.id);

    for (const column of table.columns) {
      await createColumn(table.id, column);
    }

    await waitForColumns(table.id);

    for (const indexDef of table.indexes) {
      const [indexId, columns, indexType = "key"] = indexDef;
      const resolvedType =
        indexType === "unique" || indexType === TablesDBIndexType.Unique
          ? TablesDBIndexType.Unique
          : TablesDBIndexType.Key;

      await ensureIndex({
        columns,
        indexId,
        indexType: resolvedType,
        tableId: table.id,
      });
    }
  }

  await migrateRecommendationRequestKeys();
  await migrateLegacyEventCommittees();
  await migrateEventRoleNames();
}

async function ensureIndex({ columns, indexId, indexType, tableId }) {
  const label = `index ${tableId}.${indexId}`;

  try {
    const existing = await tables.getIndex(databaseId, tableId, indexId);

    if (existing.type !== indexType) {
      await tables.deleteIndex(databaseId, tableId, indexId);
      console.log(`deleted ${label} for type migration`);
    } else {
      console.log(`exists ${label}`);
      return;
    }
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }
  }

  await tables.createIndex(databaseId, tableId, indexId, indexType, columns);
  console.log(`created ${label}`);
}

async function migrateLegacyEventCommittees() {
  const legacyColumns = [
    "user_id",
    "role",
    "committee_name",
    "display_role",
    "assigned_by",
    "assigned_at",
    "is_active",
  ];

  for (const columnKey of legacyColumns) {
    try {
      await tables.deleteColumn(databaseId, "event_committees", columnKey);
      console.log(`removed legacy column event_committees.${columnKey}`);
    } catch (error) {
      if (error?.code !== 404) {
        throw error;
      }
    }
  }
}

async function migrateRecommendationRequestKeys() {
  let cursor;
  let migrated = 0;

  for (let page = 0; page < 20; page += 1) {
    const queries = [Query.limit(500)];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const result = await tables.listRows(
      databaseId,
      "recommendation_requests",
      queries,
      undefined,
      false,
    );

    if (result.rows.length === 0) {
      break;
    }

    for (const row of result.rows) {
      cursor = row.$id;

      if (row.requestKey || !row.requesterId || !row.respondentId) {
        continue;
      }

      await tables.updateRow(databaseId, "recommendation_requests", row.$id, {
        requestKey: recommendationRequestKey(String(row.requesterId), String(row.respondentId)),
      });
      migrated += 1;
    }

    if (result.rows.length < 500) {
      break;
    }
  }

  console.log(`migrated recommendation request keys: ${migrated}`);
}

async function migrateEventRoleNames() {
  await tables.updateEnumColumn(
    databaseId,
    "event_role_assignments",
    "role",
    [...new Set([...eventRoleElements, ...legacyEventRoleElements])],
    true,
    null,
  );
  await waitForColumns("event_role_assignments");

  const migrations = [
    ["Lead", "Committee Lead"],
    ["OC Member", "Committee Member"],
  ];

  for (const [fromRole, toRole] of migrations) {
    const result = await tables.listRows(
      databaseId,
      "event_role_assignments",
      [Query.equal("role", fromRole), Query.limit(500)],
      undefined,
      false,
    );

    for (const row of result.rows) {
      await tables.updateRow(databaseId, "event_role_assignments", row.$id, {
        role: toRole,
      });
      console.log(`migrated event role ${row.$id}: ${fromRole} -> ${toRole}`);
    }
  }

  await tables.updateEnumColumn(
    databaseId,
    "event_role_assignments",
    "role",
    eventRoleElements,
    true,
    null,
  );
  await waitForColumns("event_role_assignments");
  console.log("updated event role enum to canonical values");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
