import "server-only";

import { normalizeEmail } from "@/features/access-control/lib/rules";
import { listProfiles } from "@/features/access-control/server/profiles";
import {
  listActiveEventRoleAssignments,
  listActiveRoleAssignments,
} from "@/features/access-control/server/roles";
import type { EventRole } from "@/features/access-control/types";
import { getEventById } from "@/features/events/server/event-service";
import { getServerEnv } from "@/lib/env";
import { dedupeRecipientUserIds } from "@/features/notifications/server/workflow-notifications";
import { EXCOM_ROLES } from "@/lib/config";

const EVENT_MANAGER_ROLES = ["Chair", "Vice Chair", "Committee Lead"] as const;

export async function getEventNotificationContext(
  eventId: string,
  options: {
    excludeUserIds?: string[];
    managerOnly?: boolean;
  } = {},
) {
  const [assignments, profiles, event] = await Promise.all([
    listActiveEventRoleAssignments(),
    listProfiles(),
    getEventById(eventId),
  ]);
  const excluded = new Set(options.excludeUserIds ?? []);
  const activeVerifiedProfileIds = new Set(
    profiles
      .filter((profile) => profile.status === "ACTIVE" && profile.uomVerified)
      .map((profile) => profile.authUserId),
  );
  const eventAssignments = assignments.filter(
    (assignment) =>
      assignment.eventId === eventId &&
      activeVerifiedProfileIds.has(assignment.userId) &&
      !excluded.has(assignment.userId) &&
      (!options.managerOnly || isEventManagerRole(assignment.role)),
  );

  return {
    eventTitle: event?.title ?? eventAssignments[0]?.eventTitle ?? eventId,
    recipientUserIds: dedupeRecipientUserIds(
      eventAssignments.map((assignment) => assignment.userId),
    ),
  };
}

export async function getAdminNotificationRecipientIds(options: {
  excludeUserIds?: string[];
} = {}) {
  const env = getServerEnv();
  const [profiles, sbAssignments] = await Promise.all([
    listProfiles(),
    listActiveRoleAssignments(),
  ]);
  const excluded = new Set(options.excludeUserIds ?? []);
  const activeProfileIds = new Set(
    profiles
      .filter((profile) => profile.status === "ACTIVE")
      .map((profile) => profile.authUserId),
  );
  const adminEmail = normalizeEmail(env.ADMIN_EMAIL);
  const adminProfileIds = profiles
    .filter((profile) => normalizeEmail(profile.googleEmail) === adminEmail)
    .map((profile) => profile.authUserId);
  const exComIds = sbAssignments
    .filter(
      (assignment) =>
        assignment.active &&
        (EXCOM_ROLES as readonly string[]).includes(assignment.role) &&
        activeProfileIds.has(assignment.userId),
    )
    .map((assignment) => assignment.userId);

  return dedupeRecipientUserIds(
    [...adminProfileIds, ...exComIds].filter((userId) => !excluded.has(userId)),
  );
}

function isEventManagerRole(role: EventRole) {
  return EVENT_MANAGER_ROLES.includes(
    role as (typeof EVENT_MANAGER_ROLES)[number],
  );
}
