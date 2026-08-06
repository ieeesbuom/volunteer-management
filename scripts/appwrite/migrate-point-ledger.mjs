#!/usr/bin/env node
/**
 * Migrate legacy point-ledger rows to deterministic pl_ IDs without changing totals.
 *
 * Usage:
 *   node scripts/appwrite/migrate-point-ledger.mjs [--apply]
 */

import { createHash } from "node:crypto";
import { createAdminContext, loadLocalEnv } from "./client.mjs";
import { pointLedgerRowId } from "./ids.mjs";

loadLocalEnv();

const apply = process.argv.includes("--apply");
const { databaseId, tables, Query } = createAdminContext();
const TABLE = "point_ledger";

function aggregateKey(row) {
  return `${row.userId}:${row.eventId}:${row.source}`;
}

function checksum(rows) {
  return createHash("sha256")
    .update(
      rows
        .map((row) => `${row.$id}:${row.userId}:${row.eventId}:${row.source}:${row.points}`)
        .sort()
        .join("|"),
    )
    .digest("hex");
}

async function listAllRows() {
  const rows = [];
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(100)];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const result = await tables.listRows(databaseId, TABLE, queries);
    rows.push(...(result.rows ?? []));

    if ((result.rows ?? []).length < 100) {
      break;
    }

    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows;
}

const beforeRows = await listAllRows();
const beforeChecksum = checksum(beforeRows);

const gradeRoleRows = beforeRows.filter((row) => row.source === "grade" || row.source === "role");
const groups = new Map();

for (const row of gradeRoleRows) {
  const key = aggregateKey(row);
  const bucket = groups.get(key) ?? [];
  bucket.push(row);
  groups.set(key, bucket);
}

const actions = [];

for (const [key, bucket] of groups) {
  const [userId, eventId, source] = key.split(":");
  const targetRowId = pointLedgerRowId(userId, eventId, source);
  const deterministic = bucket.find((row) => row.$id === targetRowId);
  const legacyRows = bucket.filter((row) => row.$id !== targetRowId);
  const points = bucket.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const template =
    deterministic ??
    legacyRows.find((row) => row.conclusionApprovalDate) ??
    legacyRows[0] ??
    bucket[0];

  if (legacyRows.length === 0 && deterministic) {
    continue;
  }

  actions.push({
    key,
    targetRowId,
    legacyRowIds: legacyRows.map((row) => row.$id),
    points,
  });

  if (!apply) {
    continue;
  }

  const payload = {
    conclusionApprovalDate: template.conclusionApprovalDate,
    createdAt: template.createdAt ?? template.conclusionApprovalDate,
    createdBy: template.createdBy,
    eventId,
    points,
    source,
    term: template.term,
    userId,
  };

  if (deterministic?.$id) {
    await tables.updateRow(databaseId, TABLE, targetRowId, payload);
  } else {
    try {
      await tables.createRow(databaseId, TABLE, targetRowId, payload);
    } catch {
      await tables.updateRow(databaseId, TABLE, targetRowId, payload);
    }
  }

  for (const legacyRow of legacyRows) {
    await tables.deleteRow(databaseId, TABLE, legacyRow.$id);
  }
}

const afterRows = apply ? await listAllRows() : beforeRows;
const afterChecksum = checksum(afterRows);

const totalsBefore = gradeRoleRows.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
const totalsAfter = afterRows
  .filter((row) => row.source === "grade" || row.source === "role")
  .reduce((sum, row) => sum + Number(row.points ?? 0), 0);

const report = {
  apply,
  rowCount: beforeRows.length,
  gradeRoleGroups: groups.size,
  migrationActions: actions.length,
  totalsBefore,
  totalsAfter,
  totalsMatch: totalsBefore === totalsAfter,
  beforeChecksum,
  afterChecksum,
  actions,
};

console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.error("Dry run only. Re-run with --apply to migrate point-ledger rows.");
}

if (totalsBefore !== totalsAfter) {
  process.exitCode = 1;
}
