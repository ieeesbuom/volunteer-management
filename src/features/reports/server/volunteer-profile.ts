import "server-only";

import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments, listActiveRoleAssignments } from "@/features/access-control/server/roles";
import type { VolunteerProfileExport } from "@/features/reports/types";
import type { ParticipationRecord, PointLedgerEntry } from "@/features/scoring/types";
import { listVisibleRecommendationsForVolunteer } from "@/features/recommendations/server/recommendations";
import { listEvents } from "@/features/events/server/event-service";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";

type VolunteerPointsLedger = NonNullable<VolunteerProfileExport["pointsLedger"]>;
type VolunteerPointsLedgerEntry = VolunteerPointsLedger["entries"][number];
type VolunteerParticipationEntry = VolunteerProfileExport["participations"][number];

async function listParticipationRecords() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.participationRecords,
    [Query.limit(1000)],
    undefined,
    false,
  );

  return result.rows as unknown as ParticipationRecord[];
}

async function listPointLedgerEntries() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [Query.limit(1000)],
    undefined,
    false,
  );

  return result.rows as unknown as PointLedgerEntry[];
}

export async function listVolunteerProfiles(): Promise<VolunteerProfileExport[]> {
  const [
    profiles,
    sbAssignments,
    eventAssignments,
    participationRecords,
    pointLedgerEntries,
    events,
  ] = await Promise.all([
    listProfiles(),
    listActiveRoleAssignments(),
    listActiveEventRoleAssignments(),
    listParticipationRecords(),
    listPointLedgerEntries(),
    listEvents(),
  ]);
  const eventsById = new Map(events.map((event) => [event.$id, event]));
  const assignmentsByEventAndUser = new Map(
    eventAssignments.map((assignment) => [
      `${assignment.eventId}:${assignment.userId}`,
      assignment,
    ]),
  );

  const sbRolesByUser = new Map<string, VolunteerProfileExport["sbRoles"]>();

  for (const assignment of sbAssignments) {
    const current = sbRolesByUser.get(assignment.userId) ?? [];
    sbRolesByUser.set(assignment.userId, [...current, assignment.role]);
  }

  const participationsByUser = new Map<string, VolunteerProfileExport["participations"]>();

  for (const record of participationRecords.filter((entry) => entry.status === "attended")) {
    const current = participationsByUser.get(record.userId) ?? [];
    const assignment = assignmentsByEventAndUser.get(`${record.eventId}:${record.userId}`);
    const event = eventsById.get(record.eventId);

    participationsByUser.set(record.userId, [
      ...current,
      {
        assignedAt: record.createdAt,
        committeeName: assignment?.committeeName,
        eventId: record.eventId,
        eventTitle: event?.title ?? assignment?.eventTitle ?? record.eventId,
        role: (assignment?.role ?? record.role) as VolunteerParticipationEntry["role"],
      },
    ]);
  }

  const pointsByUser = new Map<string, VolunteerPointsLedger>();

  for (const entry of pointLedgerEntries) {
    const current = pointsByUser.get(entry.userId) ?? { entries: [], total: 0 };
    const assignment = assignmentsByEventAndUser.get(`${entry.eventId}:${entry.userId}`);
    const event = eventsById.get(entry.eventId);

    current.total += Number(entry.points);
    current.entries.push({
      $id: entry.$id,
      awardedAt: entry.conclusionApprovalDate,
      eventId: entry.eventId,
      eventTitle: event?.title ?? assignment?.eventTitle ?? entry.eventId,
      points: Number(entry.points),
      role: (assignment?.role ?? "Committee Member") as VolunteerPointsLedgerEntry["role"],
    });
    pointsByUser.set(entry.userId, current);
  }

  const recommendationsByUser = new Map<string, VolunteerProfileExport["recommendations"]>();

  await Promise.all(
    profiles
      .filter((profile) => profile.status === "ACTIVE")
      .map(async (profile) => {
        const recommendations = await listVisibleRecommendationsForVolunteer(profile.authUserId);
        recommendationsByUser.set(
          profile.authUserId,
          recommendations.map((recommendation) => ({
            $id: recommendation.$id,
            createdAt: recommendation.createdAt,
            eventTitle: "Recommendation",
            fromName:
              recommendation.respondent?.name ||
              recommendation.respondent?.uomEmail ||
              recommendation.respondent?.googleEmail ||
              recommendation.respondentId,
            note: recommendation.text,
          })),
        );
      }),
  );

  return profiles
    .filter((profile) => profile.status === "ACTIVE")
    .map((profile) => ({
      googleEmail: profile.googleEmail,
      name: profile.name ?? profile.googleEmail,
      participations: participationsByUser.get(profile.authUserId) ?? [],
      pointsLedger: pointsByUser.get(profile.authUserId) ?? { entries: [], total: 0 },
      recommendations: recommendationsByUser.get(profile.authUserId) ?? [],
      sbRoles: sbRolesByUser.get(profile.authUserId) ?? [],
      uomEmail: profile.uomEmail,
      userId: profile.authUserId,
    }));
}

export async function getVolunteerProfile(userId: string) {
  const profiles = await listVolunteerProfiles();
  return profiles.find((profile) => profile.userId === userId) ?? null;
}

export async function assertVolunteerProfileExportable(userId: string) {
  const profile = await getVolunteerProfile(userId);

  if (!profile) {
    throw new Error("Volunteer profile was not found.");
  }

  return profile;
}
