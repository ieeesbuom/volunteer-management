import {
  canVolunteer,
  isFormOnUserChairedEvent,
  normalizeEventReference,
  userIsEventChair,
} from "@/features/access-control/lib/rules";
import type { EventRoleAssignment, SessionUser } from "@/features/access-control/types";
import { parseLavaScheduleMs } from "@/features/forms/lib/lava-schedule";
import { isOperationalFormPurpose } from "@/features/forms/lib/lava-form-presets";
import { isLavaFormProvider, type FormConnection } from "@/features/forms/types";

export const FORM_AUDIENCE_TIERS = [
  "public",
  "volunteers_only",
  "event_team_only",
  "chairs_only",
] as const;

export type FormAudienceTier = (typeof FORM_AUDIENCE_TIERS)[number];

export type FormAudienceMetadata = {
  audience: FormAudienceTier;
  closeAt?: string;
  openAt?: string;
  targetCommitteeId?: string;
  targetCommitteeName?: string;
};

export type FormRoleAssignment = {
  committeeId?: string;
  committeeName?: string;
  eventId?: string;
  role?: string;
  userId: string;
};

function parseScheduleInstant(value: string, endOfDay = false): number | null {
  return parseLavaScheduleMs(value, endOfDay);
}

export function getFormAudienceMetadata(connection: FormConnection): FormAudienceMetadata {
  const meta = connection.metadata as Record<string, unknown> | undefined;
  const audienceRaw = typeof meta?.audience === "string" ? meta.audience : "public";
  const audience: FormAudienceTier =
    audienceRaw === "volunteers_only" ||
    audienceRaw === "event_team_only" ||
    audienceRaw === "chairs_only"
      ? audienceRaw
      : "public";

  const targetCommitteeId =
    typeof meta?.targetCommitteeId === "string" && meta.targetCommitteeId
      ? meta.targetCommitteeId
      : undefined;
  const targetCommitteeName =
    typeof meta?.targetCommitteeName === "string" && meta.targetCommitteeName
      ? meta.targetCommitteeName
      : undefined;

  const openAt = typeof meta?.openAt === "string" ? meta.openAt : undefined;
  const closeAt = typeof meta?.closeAt === "string" ? meta.closeAt : undefined;

  return {
    audience,
    closeAt,
    openAt,
    targetCommitteeId,
    targetCommitteeName,
  };
}

export function isFormScheduleOpen(
  connection: FormConnection,
  now: Date = new Date(),
): boolean {
  const { openAt, closeAt } = getFormAudienceMetadata(connection);
  const nowMs = now.getTime();

  if (openAt) {
    const openMs = parseScheduleInstant(openAt);
    if (openMs !== null && nowMs < openMs) {
      return false;
    }
  }

  if (closeAt) {
    const closeMs = parseScheduleInstant(closeAt, true);
    if (closeMs !== null && nowMs > closeMs) {
      return false;
    }
  }

  return true;
}

function normalizeCommitteeKey(value?: string) {
  return value?.trim().toLowerCase() || undefined;
}

function assignmentMatchesCommitteeTarget(
  assignment: FormRoleAssignment,
  {
    committeesMap,
    targetCommitteeId,
    targetCommitteeName,
  }: {
    committeesMap?: Map<string, string>;
    targetCommitteeId?: string;
    targetCommitteeName?: string;
  },
) {
  const targets = new Set<string>();
  const idKey = normalizeCommitteeKey(targetCommitteeId);
  const nameKey = normalizeCommitteeKey(targetCommitteeName);
  if (idKey) {
    targets.add(idKey);
  }
  if (nameKey) {
    targets.add(nameKey);
  }
  if (targetCommitteeId && committeesMap?.has(targetCommitteeId)) {
    const mapped = normalizeCommitteeKey(committeesMap.get(targetCommitteeId));
    if (mapped) {
      targets.add(mapped);
    }
  }

  if (targets.size === 0) {
    return true;
  }

  const assignmentKeys = [
    normalizeCommitteeKey(assignment.committeeId),
    normalizeCommitteeKey(assignment.committeeName),
  ].filter(Boolean) as string[];

  return assignmentKeys.some((key) => targets.has(key));
}

function isChairRole(role?: string) {
  return role === "Chair" || role === "Vice Chair";
}

export function isFormVisibleToUser({
  canManage = false,
  committeesMap,
  connection,
  currentUserId,
  isAdmin = false,
  isVolunteer = false,
  now,
  userRoleAssignments = [],
}: {
  canManage?: boolean;
  committeesMap?: Map<string, string>;
  connection: FormConnection;
  currentUserId?: string;
  isAdmin?: boolean;
  isVolunteer?: boolean;
  now?: Date;
  userRoleAssignments?: FormRoleAssignment[];
}): boolean {
  if (canManage) {
    return true;
  }

  if (!isFormScheduleOpen(connection, now)) {
    return false;
  }

  const { audience, targetCommitteeId, targetCommitteeName } =
    getFormAudienceMetadata(connection);

  if (audience === "public") {
    return true;
  }

  if (audience === "volunteers_only") {
    return Boolean(currentUserId) && (isVolunteer || isAdmin);
  }

  if (!currentUserId) {
    return false;
  }

  const myAssignments = userRoleAssignments.filter((assignment) => {
    if (assignment.userId !== currentUserId) {
      return false;
    }
    if (!assignment.eventId) {
      return true;
    }
    return (
      normalizeEventReference(assignment.eventId) ===
      normalizeEventReference(connection.eventId)
    );
  });

  if (audience === "chairs_only") {
    return isAdmin || myAssignments.some((assignment) => isChairRole(assignment.role));
  }

  if (audience === "event_team_only") {
    if (myAssignments.length === 0) {
      return false;
    }

    if (!targetCommitteeId && !targetCommitteeName) {
      return true;
    }

    return myAssignments.some((assignment) =>
      assignmentMatchesCommitteeTarget(assignment, {
        committeesMap,
        targetCommitteeId,
        targetCommitteeName,
      }),
    );
  }

  return false;
}

export function hasFormDestination(connection: FormConnection) {
  if (isLavaFormProvider(connection.provider)) {
    return Boolean(connection.externalFormId);
  }

  return Boolean(connection.formUrl);
}

/** Active form with a destination that is currently within its availability window. */
export function isFormBaseEligible(connection: FormConnection, now: Date = new Date()) {
  return (
    connection.status === "active" &&
    hasFormDestination(connection) &&
    isFormScheduleOpen(connection, now)
  );
}

/**
 * Whether a form should appear on the signed-in user's dashboard overview.
 * Public / volunteer open-call forms are open opportunities.
 * Event-team / chair forms appear only when the user is assigned to that event.
 */
export function isFormEligibleForDashboard(
  connection: FormConnection,
  user: Pick<SessionUser, "authUser" | "eventRoles" | "isAdmin" | "profile">,
  now: Date = new Date(),
): boolean {
  if (!isFormBaseEligible(connection, now)) {
    return false;
  }

  // Event chairs manage forms only on events they lead — not branch-wide open calls.
  if (userIsEventChair(user)) {
    if (!isFormOnUserChairedEvent(connection.eventId, user)) {
      return false;
    }

    return isFormVisibleToUser({
      canManage: true,
      connection,
      currentUserId: user.authUser.id,
      isAdmin: user.isAdmin,
      isVolunteer: canVolunteer(user.profile),
      now,
      userRoleAssignments: toDashboardRoleAssignments(user.eventRoles),
    });
  }

  const { audience } = getFormAudienceMetadata(connection);
  const isTeamScoped = audience === "event_team_only" || audience === "chairs_only";

  // Open opportunities exclude operational form types.
  // Registration, grants, t-shirts, team calls, and "other" remain eligible.
  if (!isTeamScoped && isOperationalFormPurpose(connection.purpose)) {
    return false;
  }

  return isFormVisibleToUser({
    connection,
    currentUserId: user.authUser.id,
    isAdmin: user.isAdmin,
    isVolunteer: canVolunteer(user.profile),
    now,
    userRoleAssignments: toDashboardRoleAssignments(user.eventRoles),
  });
}

/** @deprecated Prefer isFormEligibleForDashboard with user context. */
export function isEligibleForGlobalDashboard(connection: FormConnection): boolean {
  if (
    connection.status !== "active" ||
    connection.purpose !== "registration" ||
    !hasFormDestination(connection)
  ) {
    return false;
  }

  const { audience, targetCommitteeId, targetCommitteeName } =
    getFormAudienceMetadata(connection);
  return (
    (audience === "public" || audience === "volunteers_only") &&
    !targetCommitteeId &&
    !targetCommitteeName
  );
}

export function shouldExcludeAssignedEventOpportunity(
  connection: FormConnection,
  assignedEventIds: Set<string>,
): boolean {
  const { audience } = getFormAudienceMetadata(connection);
  // Only hide public registration-style opportunities once the user already has an
  // event role. Verified-volunteer / team / chair forms can still be relevant.
  if (audience !== "public") {
    return false;
  }

  return [...assignedEventIds].some(
    (id) =>
      normalizeEventReference(id) === normalizeEventReference(connection.eventId),
  );
}

export function isOpenOpportunityAudience(connection: FormConnection): boolean {
  const { audience } = getFormAudienceMetadata(connection);
  return audience === "public" || audience === "volunteers_only";
}

export function formatAudienceBadge(
  audience: FormAudienceTier,
  targetCommitteeId?: string,
  committeesMap?: Map<string, string>,
  targetCommitteeName?: string,
): {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning" | "danger";
} {
  if (audience === "chairs_only") {
    return { label: "Chairs & Admins Only", tone: "warning" };
  }

  if (audience === "event_team_only") {
    const committeeLabel =
      (targetCommitteeId ? committeesMap?.get(targetCommitteeId) : undefined) ??
      targetCommitteeName ??
      targetCommitteeId;
    if (committeeLabel) {
      return { label: `Target: ${committeeLabel}`, tone: "primary" };
    }
    return { label: "Event Team Only", tone: "primary" };
  }

  if (audience === "volunteers_only") {
    return { label: "Verified Volunteers", tone: "success" };
  }

  return { label: "Public", tone: "neutral" };
}

export function toDashboardRoleAssignments(
  eventRoles: EventRoleAssignment[],
): FormRoleAssignment[] {
  return eventRoles.map((role) => ({
    committeeName: role.committeeName,
    eventId: role.eventId,
    role: role.role,
    userId: role.userId,
  }));
}
