import "server-only";

import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  createCodeHash,
  createVerificationCode,
  createVerificationExpiry,
  hasAttemptsRemaining,
  isVerificationExpired,
} from "@/features/access-control/lib/verification";
import { normalizeUomEmail } from "@/features/access-control/lib/rules";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { sendUomVerificationCode } from "@/server/email/adapter";
import { getProfile, markProfileUomVerified } from "@/features/access-control/server/profiles";
import type { UomVerificationStatus } from "@/features/access-control/types";
import { getVerificationPepper } from "@/features/access-control/server/verification-pepper";
import { claimVerifiedUomEmail } from "@/features/access-control/server/uom-email-claim";
import { safeDigestEquals } from "@/server/tokens";

type VerificationRow = {
  $id: string;
  attempts: number;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  status: UomVerificationStatus;
  uomEmail: string;
  userId: string;
  verifiedAt?: string;
};

const UOM_VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

function toVerificationRow(row: Record<string, unknown>): VerificationRow {
  return {
    $id: String(row.$id),
    attempts: Number(row.attempts ?? 0),
    codeHash: String(row.codeHash),
    createdAt: String(row.$createdAt ?? row.createdAt ?? new Date().toISOString()),
    expiresAt: String(row.expiresAt),
    status: String(row.status) as UomVerificationStatus,
    uomEmail: String(row.uomEmail),
    userId: String(row.userId),
    verifiedAt:
      typeof row.verifiedAt === "string" && row.verifiedAt
        ? row.verifiedAt
        : undefined,
  };
}

export async function requestUomVerification({
  uomEmail,
  userId,
}: {
  uomEmail: string;
  userId: string;
}) {
  const env = getServerEnv();
  const profile = await getProfile(userId);

  if (profile?.uomVerified) {
    throw new Error("UoM email is already verified.");
  }

  const normalizedUomEmail = normalizeUomEmail(uomEmail);
  const { tables } = getAppwriteAdminServices();

  const existingProfiles = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    [
      Query.equal("uomEmail", normalizedUomEmail),
      Query.equal("uomVerified", true),
      Query.limit(1),
    ]
  );

  if (existingProfiles.total > 0) {
    throw new Error("This UoM email is already verified by another account.");
  }

  const pending = await getLatestPendingVerification(userId);

  if (
    pending &&
    pending.uomEmail === normalizedUomEmail &&
    !isVerificationExpired(pending.expiresAt)
  ) {
    const ageMs = Date.now() - new Date(pending.createdAt).getTime();

    if (ageMs < UOM_VERIFICATION_RESEND_COOLDOWN_MS) {
      return {
        deliveredTo: normalizedUomEmail,
        expiresAt: pending.expiresAt,
        requestId: pending.$id,
        resent: false,
      };
    }

    return resendVerificationForRow({
      env,
      normalizedUomEmail,
      rowId: pending.$id,
      tables,
      userId,
    });
  }

  const code = createVerificationCode();
  const codeHash = createCodeHash({
    code,
    pepper: getVerificationPepper(),
    uomEmail: normalizedUomEmail,
    userId,
  });

  const expiresAt = createVerificationExpiry();
  const row = await tables.createRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    ID.unique(),
    {
      attempts: 0,
      codeHash,
      expiresAt,
      status: "PENDING",
      uomEmail: normalizedUomEmail,
      userId,
    },
  );

  const delivery = await deliverVerificationCode({
    code,
    env,
    normalizedUomEmail,
    rowId: row.$id,
    tables,
    userId,
  });

  return {
    deliveredTo: normalizedUomEmail,
    expiresAt,
    requestId: row.$id,
    resent: true,
    ...delivery,
  };
}

async function resendVerificationForRow({
  env,
  normalizedUomEmail,
  rowId,
  tables,
  userId,
}: {
  env: ReturnType<typeof getServerEnv>;
  normalizedUomEmail: string;
  rowId: string;
  tables: ReturnType<typeof getAppwriteAdminServices>["tables"];
  userId: string;
}) {
  const code = createVerificationCode();
  const codeHash = createCodeHash({
    code,
    pepper: getVerificationPepper(),
    uomEmail: normalizedUomEmail,
    userId,
  });
  const expiresAt = createVerificationExpiry();

  await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    rowId,
    {
      attempts: 0,
      codeHash,
      expiresAt,
      status: "PENDING",
      uomEmail: normalizedUomEmail,
    },
  );

  await deliverVerificationCode({
    code,
    env,
    normalizedUomEmail,
    rowId,
    tables,
    userId,
  });

  return {
    deliveredTo: normalizedUomEmail,
    expiresAt,
    requestId: rowId,
    resent: true,
  };
}

async function deliverVerificationCode({
  code,
  env,
  normalizedUomEmail,
  rowId,
  tables,
  userId,
}: {
  code: string;
  env: ReturnType<typeof getServerEnv>;
  normalizedUomEmail: string;
  rowId: string;
  tables: ReturnType<typeof getAppwriteAdminServices>["tables"];
  userId: string;
}) {
  let delivery;

  try {
    delivery = await sendUomVerificationCode({
      code,
      to: normalizedUomEmail,
    });
  } catch (error) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      rowId,
      { status: "CANCELLED" },
    );

    throw error;
  }

  await writeAuditLog({
    action: "UOM_VERIFICATION_REQUESTED",
    actorUserId: userId,
    metadata: {
      messageId: delivery.messageId,
      provider: delivery.provider,
      uomEmail: normalizedUomEmail,
    },
    targetId: rowId,
    targetType: "uom_verification_request",
  });

  return delivery;
}

export async function confirmUomVerification({
  code,
  requestId,
  userId,
}: {
  code: string;
  requestId: string;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = toVerificationRow(
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
    ),
  );

  if (row.userId !== userId) {
    throw new Error("Verification request does not belong to this user.");
  }

  const existingProfile = await getProfile(userId);

  if (existingProfile?.uomVerified) {
    throw new Error("UoM email is already verified.");
  }

  const existingProfiles = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    [
      Query.equal("uomEmail", row.uomEmail),
      Query.equal("uomVerified", true),
      Query.limit(1),
    ]
  );

  if (existingProfiles.total > 0 && existingProfiles.rows[0].$id !== userId) {
    throw new Error("This UoM email is already verified by another account.");
  }

  if (row.status !== "PENDING") {
    throw new Error("Verification request is not pending.");
  }

  if (isVerificationExpired(row.expiresAt)) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
      { status: "EXPIRED" },
    );
    throw new Error("Verification code has expired.");
  }

  if (!hasAttemptsRemaining(row.attempts)) {
    throw new Error("Verification attempt limit reached.");
  }

  const codeHash = createCodeHash({
    code,
    pepper: getVerificationPepper(),
    uomEmail: row.uomEmail,
    userId,
  });

  if (!safeDigestEquals(codeHash, row.codeHash)) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
      { attempts: row.attempts + 1 },
    );
    throw new Error("Invalid verification code.");
  }

  await claimVerifiedUomEmail({
    actorUserId: userId,
    normalizedUomEmail: row.uomEmail,
    userId,
  });

  const verifiedAt = new Date().toISOString();
  await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    requestId,
    {
      status: "VERIFIED",
      verifiedAt,
    },
  );

  const profile = await markProfileUomVerified({
    uomEmail: row.uomEmail,
    userId,
  });

  await writeAuditLog({
    action: "UOM_VERIFICATION_CONFIRMED",
    actorUserId: userId,
    metadata: { uomEmail: row.uomEmail },
    targetId: requestId,
    targetType: "uom_verification_request",
  });

  return profile;
}

export async function getLatestPendingVerification(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    [
      Query.equal("userId", userId),
      Query.equal("status", "PENDING"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  return result.rows[0] ? toVerificationRow(result.rows[0]) : null;
}
