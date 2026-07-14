import "server-only";

import { cache } from "react";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments, listActiveRoleAssignments } from "@/features/access-control/server/roles";
import type { VolunteerProfileExport } from "@/features/reports/types";
import type { PointLedgerEntry } from "@/features/scoring/types";
import { listEvents } from "@/features/events/server/event-service";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";

type VolunteerPointsLedger = NonNullable<VolunteerProfileExport["pointsLedger"]>;
type VolunteerPointsLedgerEntry = VolunteerPointsLedger["entries"][number];
type VolunteerParticipationEntry = VolunteerProfileExport["participations"][number];
type VisibleRecommendationRow = {
  $id: string;
  createdAt: string;
  requesterId: string;
  respondentId: string;
  text: string;
};


const listPointLedgerEntries = cache(async function listPointLedgerEntries() {
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
});

const listVisibleRecommendationRows = cache(async function listVisibleRecommendationRows() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.recommendations,
    [Query.equal("status", "VISIBLE"), Query.orderDesc("createdAt"), Query.limit(1000)],
    undefined,
    false,
  );

  return result.rows as unknown as VisibleRecommendationRow[];
});

export const listVolunteerProfiles = cache(async function listVolunteerProfiles(): Promise<VolunteerProfileExport[]> {
  const [
    profiles,
    sbAssignments,
    eventAssignments,
    pointLedgerEntries,
    events,
    visibleRecommendations,
  ] = await Promise.all([
    listProfiles(),
    listActiveRoleAssignments(),
    listActiveEventRoleAssignments(),
    listPointLedgerEntries(),
    listEvents(),
    listVisibleRecommendationRows(),
  ]);
  const profilesByUserId = new Map(profiles.map((profile) => [profile.authUserId, profile]));
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

  for (const assignment of eventAssignments) {
    const current = participationsByUser.get(assignment.userId) ?? [];
    const event = eventsById.get(assignment.eventId);

    participationsByUser.set(assignment.userId, [
      ...current,
      {
        assignedAt: assignment.assignedAt,
        committeeName: assignment.committeeName,
        eventId: assignment.eventId,
        eventTitle: event?.title ?? assignment.eventTitle ?? assignment.eventId,
        role: assignment.role as VolunteerParticipationEntry["role"],
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

  for (const recommendation of visibleRecommendations) {
    const current = recommendationsByUser.get(recommendation.requesterId) ?? [];
    const respondent = profilesByUserId.get(recommendation.respondentId);
    recommendationsByUser.set(recommendation.requesterId, [
      ...current,
      {
        $id: recommendation.$id,
        createdAt: recommendation.createdAt,
        eventTitle: "Recommendation",
        fromName:
          respondent?.name ||
          respondent?.uomEmail ||
          respondent?.googleEmail ||
          "Unknown volunteer",
        note: recommendation.text,
      },
    ]);
  }

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
});

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
