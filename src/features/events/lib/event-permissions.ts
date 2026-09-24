import type { EventRole } from "@/features/access-control/types";
import type { Event, EventPermissions, EventStatus } from "@/features/events/types";

const EDITABLE_STATUSES: EventStatus[] = ["draft", "planning"];
const EARLY_CREATOR_STATUSES: EventStatus[] = ["draft", "planning"];
export const DELETABLE_STATUSES: EventStatus[] = ["draft", "planning"];
/** Shown in All Events for every verified volunteer; detail page stays members-only. */
export const LISTABLE_PUBLIC_STATUSES: EventStatus[] = [
  "published",
  "ongoing",
  "pending_conclusion",
];

const VIEW_ONLY_PERMISSIONS: EventPermissions = {
  canApproveConclusion: false,
  canAssignRoles: false,
  canDelete: false,
  canEdit: false,
  canManageCommittee: false,
  canPublish: false,
  canSubmitConclusion: false,
};

const ADMIN_PERMISSIONS: EventPermissions = {
  canApproveConclusion: true,
  canAssignRoles: true,
  canDelete: true,
  canEdit: true,
  canManageCommittee: true,
  canPublish: true,
  canSubmitConclusion: true,
};

export function isEventVisibleToUser(
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole?: EventRole | null,
) {
  if (isAdmin) {
    return true;
  }

  if (userEventRole != null) {
    return true;
  }

  if (event.created_by === userId && EARLY_CREATOR_STATUSES.includes(event.status)) {
    return true;
  }

  return false;
}

/** Whether an event card may appear in browse lists (broader than detail access). */
export function isEventListedForUser(
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole?: EventRole | null,
) {
  if (isEventVisibleToUser(userId, isAdmin, event, userEventRole)) {
    return true;
  }

  return LISTABLE_PUBLIC_STATUSES.includes(event.status);
}

/** Lifecycle phases (ongoing, closed, conclusion, etc.) are for admin and event Chair only. */
export function canViewEventLifecycle(
  isAdmin: boolean,
  eventId: string,
  eventRoles: Array<{ active?: boolean; eventId?: string; role?: string }> = [],
) {
  if (isAdmin) {
    return true;
  }

  return eventRoles.some(
    (role) =>
      role.active !== false &&
      role.eventId === eventId &&
      role.role === "Chair",
  );
}

export function getEventPermissions(
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole?: EventRole | null,
): EventPermissions {
  if (isAdmin) {
    return {
      ...ADMIN_PERMISSIONS,
      canDelete: DELETABLE_STATUSES.includes(event.status),
    };
  }

  if (
    userEventRole === "Chair" ||
    userEventRole === "Vice Chair" ||
    userEventRole === "Committee Lead"
  ) {
    return {
      canApproveConclusion: false,
      canAssignRoles: userEventRole === "Chair",
      canDelete: false,
      canEdit: userEventRole === "Chair" && EDITABLE_STATUSES.includes(event.status),
      canManageCommittee: userEventRole === "Chair",
      canPublish: false,
      canSubmitConclusion:
        (userEventRole === "Chair" || userEventRole === "Vice Chair") &&
        event.status === "ongoing",
    };
  }

  void userId;
  return VIEW_ONLY_PERMISSIONS;
}
