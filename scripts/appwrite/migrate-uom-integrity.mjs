#!/usr/bin/env node
/**
 * Repair UoM claim rows, backfill hashed claims, expire stale pending verifications,
 * and optionally resolve duplicate verified emails / orphan profiles.
 *
 * Usage:
 *   node scripts/appwrite/migrate-uom-integrity.mjs [--apply]
 *   node scripts/appwrite/migrate-uom-integrity.mjs --apply --duplicate-email user@uom.lk --keep-user-id <authUserId>
 *   node scripts/appwrite/migrate-uom-integrity.mjs --apply --archive-orphan-profile <profileRowId>
 */

import { createAdminContext, loadLocalEnv } from "./client.mjs";
import { hashUserId, normalizeUomEmail, uomEmailClaimRowId, uomEmailClaimSettingKey } from "./ids.mjs";

loadLocalEnv();

const apply = process.argv.includes("--apply");
const duplicateEmailIndex = process.argv.indexOf("--duplicate-email");
const keepUserIndex = process.argv.indexOf("--keep-user-id");
const orphanProfileIds = process.argv.includes("--archive-orphan-profile")
  ? process.argv
      .map((arg, index, argv) => (arg === "--archive-orphan-profile" ? argv[index + 1]?.trim() : null))
      .filter(Boolean)
  : [];

const duplicateEmail =
  duplicateEmailIndex >= 0 ? normalizeUomEmail(process.argv[duplicateEmailIndex + 1]) : null;
const keepUserId = keepUserIndex >= 0 ? process.argv[keepUserIndex + 1]?.trim() : null;

const { databaseId, tables, users, Query } = createAdminContext();

const TABLES = {
  profiles: "profiles",
  systemSettings: "system_settings",
  uomVerificationRequests: "uom_verification_requests",
  eventRoleAssignments: "event_role_assignments",
};

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

const authUsers = await users.list({ total: false });
const authUserIds = new Set((authUsers.users ?? []).map((user) => user.$id));
const profiles = await listAllRows(TABLES.profiles);
const verificationRequests = await listAllRows(TABLES.uomVerificationRequests);

const orphanProfiles = profiles.filter((profile) => !authUserIds.has(profile.authUserId));
const verifiedProfiles = profiles.filter((profile) => profile.uomVerified && profile.uomEmail);

const duplicateGroups = new Map();
for (const profile of verifiedProfiles) {
  const normalized = normalizeUomEmail(profile.uomEmail);
  const bucket = duplicateGroups.get(normalized) ?? [];
  bucket.push(profile);
  duplicateGroups.set(normalized, bucket);
}

const duplicateVerifiedEmails = [...duplicateGroups.entries()]
  .filter(([, bucket]) => bucket.length > 1)
  .map(([email, bucket]) => ({
    email,
    profileCount: bucket.length,
    userIds: bucket.map((profile) => hashUserId(profile.authUserId)),
  }));

const stalePending = verificationRequests.filter((request) => {
  if (request.status !== "PENDING") {
    return false;
  }

  const expiresAt = Date.parse(String(request.expiresAt ?? ""));

  return Number.isFinite(expiresAt) && expiresAt < Date.now();
});

const report = {
  apply,
  profileCount: profiles.length,
  authUserCount: authUserIds.size,
  orphanProfileCount: orphanProfiles.length,
  orphanProfiles: orphanProfiles.map((profile) => ({
    profileId: profile.$id,
    userId: hashUserId(profile.authUserId),
    uomVerified: Boolean(profile.uomVerified),
  })),
  duplicateVerifiedEmails,
  stalePendingCount: stalePending.length,
  actions: [],
};

if (duplicateVerifiedEmails.length > 0 && apply) {
  if (!duplicateEmail || !keepUserId) {
    throw new Error(
      "Duplicate verified UoM emails detected. Re-run with --duplicate-email and --keep-user-id to resolve.",
    );
  }

  const bucket = duplicateGroups.get(duplicateEmail) ?? [];
  const keepProfile = bucket.find((profile) => profile.authUserId === keepUserId);

  if (!keepProfile) {
    throw new Error("keep-user-id does not match a profile in the duplicate email group.");
  }

  for (const profile of bucket) {
    if (profile.authUserId === keepUserId) {
      continue;
    }

    report.actions.push({
      type: "clear_duplicate_verification",
      profileId: profile.$id,
      userId: hashUserId(profile.authUserId),
    });

    await tables.updateRow(databaseId, TABLES.profiles, profile.$id, {
      uomEmail: null,
      uomVerified: false,
      uomVerifiedAt: null,
    });
  }
}

for (const orphanProfileId of orphanProfileIds) {
  if (!apply) {
    report.actions.push({ type: "archive_orphan_profile_dry_run", profileId: orphanProfileId });
    continue;
  }

  const orphan = orphanProfiles.find((profile) => profile.$id === orphanProfileId);

  if (!orphan) {
    throw new Error(`Orphan profile id not found or profile is not orphaned: ${orphanProfileId}`);
  }

  const assignments = await listAllRows(TABLES.eventRoleAssignments, [
    Query.equal("userId", orphan.authUserId),
  ]);

  for (const assignment of assignments) {
    report.actions.push({ type: "delete_orphan_assignment", assignmentId: assignment.$id });
    await tables.deleteRow(databaseId, TABLES.eventRoleAssignments, assignment.$id);
  }

  report.actions.push({ type: "delete_orphan_profile", profileId: orphan.$id });
  await tables.deleteRow(databaseId, TABLES.profiles, orphan.$id);
}

for (const request of stalePending) {
  report.actions.push({ type: "expire_pending_verification", requestId: request.$id });

  if (apply) {
    await tables.updateRow(databaseId, TABLES.uomVerificationRequests, request.$id, {
      status: "EXPIRED",
    });
  }
}

const profilesForClaims = apply ? await listAllRows(TABLES.profiles) : profiles;
const verifiedForClaims = profilesForClaims.filter((profile) => profile.uomVerified && profile.uomEmail);

const claimRows = await listAllRows(TABLES.systemSettings, [Query.startsWith("key", "uom_email_claim:")]);

for (const profile of verifiedForClaims) {
  const normalized = normalizeUomEmail(profile.uomEmail);
  const rowId = uomEmailClaimRowId(normalized);
  const settingKey = uomEmailClaimSettingKey(normalized);
  const payload = {
    key: settingKey,
    updatedAt: new Date().toISOString(),
    updatedBy: profile.authUserId,
    value: JSON.stringify({ userId: profile.authUserId, normalizedUomEmail: normalized }),
  };

  const legacyRow = claimRows.find((row) => row.key === settingKey && row.$id !== rowId);

  if (legacyRow) {
    report.actions.push({ type: "delete_legacy_claim_row", rowId: legacyRow.$id });

    if (apply) {
      await tables.deleteRow(databaseId, TABLES.systemSettings, legacyRow.$id);
    }
  }

  report.actions.push({ type: "upsert_claim_row", rowId, userId: hashUserId(profile.authUserId) });

  if (apply) {
    try {
      await tables.updateRow(databaseId, TABLES.systemSettings, rowId, payload);
    } catch {
      await tables.createRow(databaseId, TABLES.systemSettings, rowId, payload);
    }
  }
}

console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.error("Dry run only. Re-run with --apply to mutate Appwrite data.");
  process.exitCode = duplicateVerifiedEmails.length > 0 || orphanProfiles.length > 0 ? 2 : 0;
}
