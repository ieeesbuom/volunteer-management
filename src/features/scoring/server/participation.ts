import "server-only";

import { createHash } from "node:crypto";
import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import type { SessionUser } from "@/features/access-control/types";
import { listProfiles } from "@/features/access-control/server/profiles";
import { getRoleAssignmentsForEvent } from "@/features/events/server/event-roles.server";
import { requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import { UpsertParticipationRecordsSchema } from "@/features/scoring/lib/schemas";
import type {
  ParticipationRecord,
  ParticipationRoster,
  ParticipationStatus,
} from "@/features/scoring/types";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { ForbiddenError, isAppwriteNotFound, ValidationError } from "@/server/errors";

type AppRow = Models.Row & Record<string, unknown>;

const PARTICIPATION_MANAGER_ROLES = ["Chair", "Vice Chair", "Committee Lead"] as const;

function participationRecordId(eventId: string, userId: string) {
  return `pr_${createHash("sha1").update(`${eventId}:${userId}`).digest("hex").slice(0, 30)}`;
}

function toParticipationRecord(row: AppRow): ParticipationRecord {
  return {
    $id: row.$id,
    createdAt: String(row.createdAt),
    eventId: String(row.eventId),
    role: String(row.role),
    status: String(row.status) as ParticipationStatus,
    updatedAt: String(row.updatedAt),
    userId: String(row.userId),
  };
}

function canManageParticipation(user: SessionUser, userEventRole?: string | null) {
  return (
    user.isAdmin ||
    Boolean(
      userEventRole &&
        PARTICIPATION_MANAGER_ROLES.includes(
          userEventRole as (typeof PARTICIPATION_MANAGER_ROLES)[number],
        ),
    )
  );
}

async function listParticipationRecords(eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.participationRecords,
    [Query.equal("eventId", eventId), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toParticipationRecord(row as AppRow));
}

export async function listEventParticipationRoster({
  eventId,
  user,
}: {
  eventId: string;
  user: SessionUser;
}): Promise<ParticipationRoster> {
  const { event, userEventRole } = await requireVisibleEvent(eventId, user);

  if (!user.isAdmin && !userEventRole) {
    throw new ForbiddenError("Event participation access is required.");
  }

  const [assignments, participationRecords, profiles] = await Promise.all([
    getRoleAssignmentsForEvent(eventId),
    listParticipationRecords(eventId),
    listProfiles(),
  ]);
  const profilesByUserId = new Map(
    profiles.map((profile) => [profile.authUserId, profile]),
  );
  const participationByUserId = new Map(
    participationRecords.map((record) => [record.userId, record]),
  );

  return {
    canManage: canManageParticipation(user, userEventRole),
    eventId,
    eventTitle: event.title,
    records: assignments.map((assignment) => {
      const profile = profilesByUserId.get(assignment.userId);

      return {
        assignedAt: assignment.assignedAt,
        committeeName: assignment.committeeName,
        eventId,
        eventTitle: assignment.eventTitle || event.title,
        googleEmail: profile?.googleEmail ?? "",
        name: profile?.name || profile?.googleEmail || assignment.userId,
        participation: participationByUserId.get(assignment.userId),
        role: assignment.role,
        uomEmail: profile?.uomEmail,
        userId: assignment.userId,
      };
    }),
  };
}

export async function upsertEventParticipationRecords({
  actor,
  eventId,
  records,
}: {
  actor: SessionUser;
  eventId: string;
  records: Array<{ userId: string; status: ParticipationStatus }>;
}) {
  const body = UpsertParticipationRecordsSchema.parse({ records });
  const { userEventRole } = await requireVisibleEvent(eventId, actor);

  if (!canManageParticipation(actor, userEventRole)) {
    throw new ForbiddenError("Event participation management permission is required.");
  }

  const assignments = await getRoleAssignmentsForEvent(eventId);
  const assignmentsByUserId = new Map(
    assignments.map((assignment) => [assignment.userId, assignment]),
  );
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const updatedRecords: ParticipationRecord[] = [];

  for (const recordInput of body.records) {
    const assignment = assignmentsByUserId.get(recordInput.userId);

    if (!assignment) {
      throw new ValidationError(
        "Only active event role assignees can receive participation records.",
      );
    }

    const rowId = participationRecordId(eventId, recordInput.userId);
    const payload = {
      eventId,
      role: assignment.role,
      status: recordInput.status,
      updatedAt: now,
      userId: recordInput.userId,
    };
    let row: AppRow;

    try {
      await tables.getRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.participationRecords,
        rowId,
      );
      row = await tables.updateRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.participationRecords,
        rowId,
        payload,
      );
    } catch (error) {
      if (!isAppwriteNotFound(error)) {
        throw error;
      }

      row = await tables.createRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.participationRecords,
        rowId,
        {
          ...payload,
          createdAt: now,
        },
      );
    }

    updatedRecords.push(toParticipationRecord(row));
  }

  await writeAuditLog({
    action: "PARTICIPATION_RECORD_UPSERTED",
    actorUserId: actor.authUser.id,
    metadata: {
      count: updatedRecords.length,
      statuses: updatedRecords.map((record) => ({
        status: record.status,
        userId: record.userId,
      })),
    },
    targetId: eventId,
    targetType: "event",
  });

  return updatedRecords;
}

