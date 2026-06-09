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
  .setKey(process.env.APPWRITE_API_KEY);

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
      ["string", "ieeeMembership", 120, false],
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
    ],
  },
  {
    id: "sb_role_assignments",
    name: "SB Role Assignments",
    columns: [
      ["string", "userId", 64, true],
      ["enum", "role", ["ExCom", "SB Lead", "SB Member"], true],
      ["string", "assignedBy", 64, true],
      ["datetime", "assignedAt", true],
      ["datetime", "revokedAt", false],
      ["boolean", "active", false, true],
    ],
    indexes: [
      ["sb_roles_user_idx", ["userId"]],
      ["sb_roles_role_idx", ["role"]],
      ["sb_roles_active_idx", ["active"]],
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
      ["audit_action_idx", ["action"]],
      ["audit_created_at_idx", ["createdAt"]],
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

    for (const [
      indexId,
      columns,
      indexType = TablesDBIndexType.Key,
    ] of table.indexes) {
      await ignoreAlreadyExists(
        () =>
          tables.createIndex(
            databaseId,
            table.id,
            indexId,
            indexType,
            columns,
          ),
        `index ${table.id}.${indexId}`,
      );
    }
  }

  await migrateRecommendationRequestKeys();
  await migrateEventRoleNames();
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
