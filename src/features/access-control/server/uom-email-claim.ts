import "server-only";

import { Query, type TablesDB } from "node-appwrite";
import {
  uomEmailClaimRowId,
  uomEmailClaimSettingKey,
} from "@/features/access-control/lib/uom-email-claim-id";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteConflict, isAppwriteNotFound } from "@/server/errors";

export async function claimVerifiedUomEmail({
  actorUserId,
  normalizedUomEmail,
  userId,
}: {
  actorUserId: string;
  normalizedUomEmail: string;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = uomEmailClaimRowId(normalizedUomEmail);
  const settingKey = uomEmailClaimSettingKey(normalizedUomEmail);
  const now = new Date().toISOString();
  const payload = {
    key: settingKey,
    updatedAt: now,
    updatedBy: actorUserId,
    value: JSON.stringify({ userId, normalizedUomEmail }),
  };

  try {
    const existing = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      rowId,
    );
    const existingUserId = JSON.parse(String(existing.value)).userId as string;

    if (existingUserId !== userId) {
      throw new Error("This UoM email is already verified by another account.");
    }

    return;
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  try {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      rowId,
      payload,
    );
  } catch (error) {
    if (!isAppwriteConflict(error)) {
      throw error;
    }

    const existing = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      rowId,
    );
    const existingUserId = JSON.parse(String(existing.value)).userId as string;

    if (existingUserId !== userId) {
      throw new Error("This UoM email is already verified by another account.");
    }
  }
}

export async function findLegacyUomEmailClaimRowId(
  tables: TablesDB,
  databaseId: string,
  normalizedUomEmail: string,
) {
  const settingKey = uomEmailClaimSettingKey(normalizedUomEmail);
  const legacyRowId = settingKey;
  const hashedRowId = uomEmailClaimRowId(normalizedUomEmail);

  if (legacyRowId === hashedRowId) {
    return null;
  }

  try {
    await tables.getRow(databaseId, APPWRITE_TABLES.systemSettings, legacyRowId);

    return legacyRowId;
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function listUomEmailClaimRowsByKeyPrefix(tables: TablesDB, databaseId: string) {
  const result = await tables.listRows(databaseId, APPWRITE_TABLES.systemSettings, [
    Query.startsWith("key", "uom_email_claim:"),
    Query.limit(500),
  ]);

  return result.rows;
}
