import "server-only";

import { hasEventRole } from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import { resolveEffectiveIsAdmin } from "@/features/access-control/server/view-mode";
import {
  getPermissionsForUser,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";

const FORM_MANAGER_EVENT_ROLES = ["Chair", "Vice Chair", "Committee Lead"] as const;
const FORM_VIEWER_EVENT_ROLES = [
  "Chair",
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
] as const;

export function canManageFormConnections(user: SessionUser, eventId: string) {
  return (
    hasActiveVerifiedProfile(user) &&
    (user.isAdmin || hasEventRole(user, eventId, [...FORM_MANAGER_EVENT_ROLES]))
  );
}

export function canListFormConnections(user: SessionUser, eventId?: string) {
  if (!hasActiveVerifiedProfile(user)) {
    return false;
  }

  if (user.isAdmin) {
    return true;
  }

  if (!eventId) {
    return false;
  }

  return hasEventRole(user, eventId, [...FORM_VIEWER_EVENT_ROLES]);
}

export async function canManageFormConnectionsForEvent(
  user: SessionUser,
  eventId: string,
) {
  if (!hasActiveVerifiedProfile(user)) {
    return false;
  }

  const { event, isAdmin, userEventRole } = await requireVisibleEvent(eventId, user);
  const permissions = getPermissionsForUser(user, event, userEventRole, { isAdmin });

  return (
    permissions.canManageCommittee ||
    permissions.canEdit ||
    hasFormManagerRole(user, eventId, isAdmin)
  );
}

export async function canListFormConnectionsForEvent(
  user: SessionUser,
  eventId?: string,
) {
  if (!hasActiveVerifiedProfile(user)) {
    return false;
  }

  if (!eventId) {
    return await resolveEffectiveIsAdmin(user.isAdmin);
  }

  const { isAdmin, userEventRole } = await requireVisibleEvent(eventId, user);

  // Senuka's event module owns event visibility. Until it exposes a
  // form-asset-specific permission, list access stays limited to event staff.
  return isAdmin || userEventRole != null || hasFormViewerRole(user, eventId);
}

function hasActiveVerifiedProfile(user: SessionUser) {
  return user.profile.status === "ACTIVE" && user.profile.uomVerified;
}

function hasFormManagerRole(user: SessionUser, eventId: string, isAdmin = user.isAdmin) {
  return isAdmin || hasEventRole(user, eventId, [...FORM_MANAGER_EVENT_ROLES]);
}

function hasFormViewerRole(user: SessionUser, eventId: string) {
  return hasEventRole(user, eventId, [...FORM_VIEWER_EVENT_ROLES]);
}
