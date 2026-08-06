import "server-only";

import { Query, type TablesDB } from "node-appwrite";
import {
  isDeterministicPointLedgerRowId,
  pointLedgerRowId,
  type PointLedgerSource,
} from "@/features/scoring/lib/point-ledger-id";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import { deriveTermFromDate } from "@/features/scoring/lib/helpers";
import type { PointLedgerEntry } from "@/features/scoring/types";

export type { PointLedgerSource } from "@/features/scoring/lib/point-ledger-id";
export { pointLedgerRowId } from "@/features/scoring/lib/point-ledger-id";

async function listGradeRoleLedgerRowsForSource({
  databaseId,
  eventId,
  source,
  tables,
  userId,
}: {
  databaseId: string;
  eventId: string;
  source: PointLedgerSource;
  tables: TablesDB;
  userId: string;
}) {
  const result = await tables.listRows(databaseId, APPWRITE_TABLES.pointLedger, [
    Query.equal("userId", userId),
    Query.equal("eventId", eventId),
    Query.equal("source", source),
    Query.limit(100),
  ]);

  return result.rows as unknown as PointLedgerEntry[];
}

export async function reconcileLegacyPointLedgerRows({
  databaseId,
  eventId,
  source,
  tables,
  userId,
}: {
  databaseId: string;
  eventId: string;
  source: PointLedgerSource;
  tables: TablesDB;
  userId: string;
}) {
  const targetRowId = pointLedgerRowId(userId, eventId, source);
  const rows = await listGradeRoleLedgerRowsForSource({
    databaseId,
    eventId,
    source,
    tables,
    userId,
  });

  if (rows.length === 0) {
    return { targetRowId, migrated: false };
  }

  const deterministic = rows.find((row) => row.$id === targetRowId);
  const legacyRows = rows.filter((row) => row.$id && row.$id !== targetRowId);

  if (legacyRows.length === 0) {
    return { targetRowId, migrated: false };
  }

  const points = deterministic?.points ?? legacyRows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  const conclusionApprovalDate =
    deterministic?.conclusionApprovalDate ??
    legacyRows.find((row) => row.conclusionApprovalDate)?.conclusionApprovalDate ??
    new Date().toISOString();
  const createdBy =
    deterministic?.createdBy ?? legacyRows.find((row) => row.createdBy)?.createdBy ?? userId;

  const payload = {
    conclusionApprovalDate,
    createdAt: conclusionApprovalDate,
    createdBy,
    eventId,
    points,
    source,
    term: deriveTermFromDate(conclusionApprovalDate),
    userId,
  };

  if (deterministic?.$id) {
    await tables.updateRow(databaseId, APPWRITE_TABLES.pointLedger, targetRowId, payload);
  } else {
    try {
      await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, targetRowId, payload);
    } catch (error) {
      if (!isAppwriteNotFound(error)) {
        throw error;
      }

      await tables.updateRow(databaseId, APPWRITE_TABLES.pointLedger, targetRowId, payload);
    }
  }

  for (const legacyRow of legacyRows) {
    if (legacyRow.$id) {
      await tables.deleteRow(databaseId, APPWRITE_TABLES.pointLedger, legacyRow.$id);
    }
  }

  return { targetRowId, migrated: true };
}

export async function upsertPointLedgerEntry({
  conclusionApprovalDate,
  createdBy,
  databaseId,
  eventId,
  points,
  source,
  tables,
  userId,
}: {
  conclusionApprovalDate: string;
  createdBy: string;
  databaseId: string;
  eventId: string;
  points: number;
  source: PointLedgerSource;
  tables: TablesDB;
  userId: string;
}) {
  await reconcileLegacyPointLedgerRows({
    databaseId,
    eventId,
    source,
    tables,
    userId,
  });

  const rowId = pointLedgerRowId(userId, eventId, source);
  const payload = {
    conclusionApprovalDate,
    createdAt: conclusionApprovalDate,
    createdBy,
    eventId,
    points,
    source,
    term: deriveTermFromDate(conclusionApprovalDate),
    userId,
  };

  try {
    await tables.updateRow(databaseId, APPWRITE_TABLES.pointLedger, rowId, payload);
    return { changed: true, rowId };
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, rowId, payload);
  return { changed: true, rowId };
}

export async function removePointLedgerEntry({
  databaseId,
  eventId,
  source,
  tables,
  userId,
}: {
  databaseId: string;
  eventId: string;
  source: PointLedgerSource;
  tables: TablesDB;
  userId: string;
}) {
  const rows = await listGradeRoleLedgerRowsForSource({
    databaseId,
    eventId,
    source,
    tables,
    userId,
  });
  let removed = false;

  for (const row of rows) {
    if (!row.$id) {
      continue;
    }

    await tables.deleteRow(databaseId, APPWRITE_TABLES.pointLedger, row.$id);
    removed = true;
  }

  return removed;
}

export async function voidEventPointLedger(eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const databaseId = env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const result = await tables.listRows(databaseId, APPWRITE_TABLES.pointLedger, [
    Query.equal("eventId", eventId),
    Query.limit(1000),
  ]);
  const rows = result.rows as unknown as PointLedgerEntry[];

  for (const row of rows) {
    if (row.source !== "grade" && row.source !== "role") {
      continue;
    }

    if (row.$id) {
      await tables.deleteRow(databaseId, APPWRITE_TABLES.pointLedger, row.$id);
    }
  }
}

export function summarizePointLedgerIntegrity(rows: PointLedgerEntry[]) {
  const duplicateSources: Array<{ userId: string; eventId: string; source: string; count: number }> =
    [];
  const legacyGradeRoleRows = rows.filter(
    (row) =>
      (row.source === "grade" || row.source === "role") &&
      row.$id &&
      !isDeterministicPointLedgerRowId(row.$id),
  );
  const groups = new Map<string, PointLedgerEntry[]>();

  for (const row of rows) {
    if (row.source !== "grade" && row.source !== "role") {
      continue;
    }

    const key = `${row.userId}:${row.eventId}:${row.source}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  for (const [key, bucket] of groups) {
    if (bucket.length <= 1) {
      continue;
    }

    const [userId, eventId, source] = key.split(":");
    duplicateSources.push({ userId, eventId, source, count: bucket.length });
  }

  return {
    duplicateSources,
    legacyGradeRoleCount: legacyGradeRoleRows.length,
  };
}
