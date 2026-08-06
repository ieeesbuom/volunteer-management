import "server-only";

import type { SessionUser } from "@/features/access-control/types";
import { hasEventRole } from "@/features/access-control/lib/rules";

export function assertCanListEventVolunteers(user: SessionUser, eventId?: string) {
  if (user.isAdmin) {
    return;
  }

  const normalizedEventId = eventId?.trim();

  if (!normalizedEventId) {
    throw new Error("Event context is required to list volunteers.");
  }

  if (hasEventRole(user, normalizedEventId, ["Chair"])) {
    return;
  }

  throw new Error("Chair or admin access is required to list event volunteers.");
}

export function assertCanInspectVolunteerEventRole(
  user: SessionUser,
  targetUserId: string,
  eventId: string,
) {
  if (user.isAdmin || user.authUser.id === targetUserId) {
    return;
  }

  if (hasEventRole(user, eventId, ["Chair"])) {
    return;
  }

  throw new Error("You do not have permission to inspect this volunteer's event role.");
}
