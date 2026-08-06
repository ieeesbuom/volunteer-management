#!/usr/bin/env node
/**
 * PII-safe Appwrite security audit (stdout JSON).
 *
 * Usage:
 *   node scripts/appwrite/security-audit.mjs
 */

import { createHash } from "node:crypto";
import { createAdminContext, loadLocalEnv } from "./client.mjs";
import { runAppwriteCli } from "./cli.mjs";
import { normalizeUomEmail, pointLedgerRowId, uomEmailClaimRowId } from "./ids.mjs";

loadLocalEnv();

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();
const { databaseId, storage, tables, users, Query } = createAdminContext();

const TABLES = {
  profiles: "profiles",
  systemSettings: "system_settings",
  pointLedger: "point_ledger",
  eventRoleAssignments: "event_role_assignments",
};

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

async function listAllRows(tableId, queries = []) {
  const rows = [];
  let cursor = null;

  for (;;) {
    const batchQueries = [...queries, Query.limit(100)];

    if (cursor) {
      batchQueries.push(Query.cursorAfter(cursor));
    }

    const result = await tables.listRows(databaseId, tableId, batchQueries);
    rows.push(...(result.rows ?? []));

    if ((result.rows ?? []).length < 100) {
      break;
    }

    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows;
}

let projectInfo = {};
let apiKeys = [];

if (projectId) {
  try {
    projectInfo = runAppwriteCli(["project", "get", "--project-id", projectId, "--json"]);
  } catch (error) {
    projectInfo = { error: error instanceof Error ? error.message : "project_get_failed" };
  }

  try {
    const keysPayload = runAppwriteCli(["project", "list-keys", "--project-id", projectId, "--json"]);
    apiKeys = keysPayload.keys ?? [];
  } catch (error) {
    apiKeys = [{ error: error instanceof Error ? error.message : "keys_list_failed" }];
  }
}

const authUsers = await users.list({ total: false });
const authUserIds = new Set((authUsers.users ?? []).map((user) => user.$id));

let staleSessionCount = 0;
let totalSessionCount = 0;
const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

for (const user of authUsers.users ?? []) {
  const sessions = await users.listSessions({ userId: user.$id, total: false });

  for (const session of sessions.sessions ?? []) {
    totalSessionCount += 1;
    const createdAt = Date.parse(session.$createdAt);

    if (Number.isFinite(createdAt) && createdAt < cutoffMs) {
      staleSessionCount += 1;
    }
  }
}

const profiles = await listAllRows(TABLES.profiles);
const orphanProfiles = profiles.filter((profile) => !authUserIds.has(profile.authUserId));

const duplicateVerifiedEmails = [];
const verifiedByEmail = new Map();

for (const profile of profiles) {
  if (!profile.uomVerified || !profile.uomEmail) {
    continue;
  }

  const normalized = normalizeUomEmail(profile.uomEmail);
  const bucket = verifiedByEmail.get(normalized) ?? [];
  bucket.push(profile.authUserId);
  verifiedByEmail.set(normalized, bucket);
}

for (const [email, userIds] of verifiedByEmail) {
  if (userIds.length > 1) {
    duplicateVerifiedEmails.push({ emailHash: hash(email), count: userIds.length });
  }
}

const claimRows = await listAllRows(TABLES.systemSettings, [Query.startsWith("key", "uom_email_claim:")]);
const missingClaims = [];

for (const [email] of verifiedByEmail) {
  const rowId = uomEmailClaimRowId(email);
  const hasHashedClaim = claimRows.some((row) => row.$id === rowId);

  if (!hasHashedClaim) {
    missingClaims.push({ emailHash: hash(email), expectedRowId: rowId });
  }
}

const ledgerRows = await listAllRows(TABLES.pointLedger);
const duplicateLedgerSources = [];
const ledgerGroups = new Map();

for (const row of ledgerRows) {
  if (row.source !== "grade" && row.source !== "role") {
    continue;
  }

  const key = `${row.userId}:${row.eventId}:${row.source}`;
  const bucket = ledgerGroups.get(key) ?? [];
  bucket.push(row.$id);
  ledgerGroups.set(key, bucket);
}

for (const [key, ids] of ledgerGroups) {
  if (ids.length <= 1) {
    continue;
  }

  const expectedId = pointLedgerRowId(...key.split(":"));
  duplicateLedgerSources.push({
    keyHash: hash(key),
    rowCount: ids.length,
    hasDeterministicId: ids.includes(expectedId),
  });
}

const legacyLedgerRows = ledgerRows.filter(
  (row) =>
    (row.source === "grade" || row.source === "role") && row.$id && !String(row.$id).startsWith("pl_"),
).length;

const activeRoles = await listAllRows(TABLES.eventRoleAssignments, [Query.equal("active", true)]);
const activeRoleGroups = new Map();

for (const assignment of activeRoles) {
  const key = `${assignment.userId}:${assignment.eventId}:${assignment.role}`;
  const bucket = activeRoleGroups.get(key) ?? [];
  bucket.push(assignment.$id);
  activeRoleGroups.set(key, bucket);
}

const duplicateActiveRoles = [...activeRoleGroups.values()].filter((bucket) => bucket.length > 1).length;

let buckets = [];

try {
  const bucketList = await storage.listBuckets();
  buckets = (bucketList.buckets ?? []).map((bucket) => ({
    id: bucket.$id,
    enabled: bucket.enabled,
    fileSecurity: bucket.fileSecurity,
    permissionCount: bucket.$permissions?.length ?? 0,
    maximumFileSize: bucket.maximumFileSize,
    extensionCount: bucket.allowedFileExtensions?.length ?? 0,
  }));
} catch (error) {
  buckets = [{ error: error instanceof Error ? error.message : "storage_list_failed" }];
}

const report = {
  generatedAt: new Date().toISOString(),
  project: {
    name: projectInfo.name,
    sessionDuration: projectInfo.authDuration,
    sessionLimit: projectInfo.authSessionsLimit,
    sessionAlerts: projectInfo.authSessionAlerts,
  },
  apiKeys: apiKeys.map((key) => ({
    name: key.name,
    scopeCount: key.scopes?.length ?? 0,
    scopes: key.scopes,
    hasExpiry: Boolean(key.expire),
    access: key.$id ? hash(key.$id) : undefined,
    error: key.error,
  })),
  sessions: {
    total: totalSessionCount,
    staleOlderThan30Days: staleSessionCount,
    userCount: authUsers.users?.length ?? 0,
  },
  profiles: {
    total: profiles.length,
    orphanCount: orphanProfiles.length,
    duplicateVerifiedEmailCount: duplicateVerifiedEmails.length,
    missingClaimRowCount: missingClaims.length,
  },
  pointLedger: {
    totalRows: ledgerRows.length,
    legacyGradeRoleRows: legacyLedgerRows,
    duplicateSourceGroups: duplicateLedgerSources.length,
  },
  eventRoles: {
    duplicateActiveAssignments: duplicateActiveRoles,
  },
  storage: {
    buckets,
  },
  backups: {
    note: "Use npm run appwrite:backups or encrypted export script; backup API requires elevated scopes/plan.",
  },
  duplicateVerifiedEmails,
  missingClaims,
  duplicateLedgerSources,
};

console.log(JSON.stringify(report, null, 2));

const hasCritical =
  duplicateVerifiedEmails.length > 0 ||
  missingClaims.length > 0 ||
  duplicateLedgerSources.length > 0 ||
  legacyLedgerRows > 0;

process.exitCode = hasCritical ? 2 : 0;
