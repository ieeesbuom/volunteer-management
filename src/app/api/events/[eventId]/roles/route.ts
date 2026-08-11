import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canAssignCommitteeRole, canManageStructuralCommittees } from "@/features/events/lib/committee-permissions";
import {
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import {
  assignEventRole,
  getRoleAssignmentsForEvent,
} from "@/features/events/server/event-roles.server";
import { notifyRoleAssignmentWorkflow } from "@/features/notifications/server/workflow-notifications";
import { AssignEventRoleInputSchema } from "@/features/events/types";
import { jsonError, jsonRouteError, ForbiddenError } from "@/server/errors";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { eventId } = await context.params;

  try {
    const { userEventRole } = await requireVisibleEvent(eventId, user!);

    if (
      !user!.isAdmin &&
      !canManageStructuralCommittees({
        isAdmin: false,
        userEventRole,
      })
    ) {
      throw new ForbiddenError("You do not have permission to view event role assignments.");
    }

    const assignments = await getRoleAssignmentsForEvent(eventId);
    return NextResponse.json({ assignments });
  } catch (error) {
    return jsonRouteError(error, "Failed to list event role assignments.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(AssignEventRoleInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  if (parsed.data.event_id !== eventId) {
    return jsonError("Event ID in the request body must match the route.", 400);
  }

  try {
    const { userEventRole } = await requireVisibleEvent(eventId, user!);

    if (
      !canAssignCommitteeRole({
        actorEventRole: userEventRole,
        isAdmin: user!.isAdmin,
        targetRole: parsed.data.role,
      })
    ) {
      throw new ForbiddenError("You do not have permission to assign this event role.");
    }

    const assignment = await assignEventRole(parsed.data, user!.authUser.id);
    const notification = await notifyRoleAssignmentWorkflow({
      actorUserId: user!.authUser.id,
      assignment,
      linkHref: `/events/${eventId}`,
    });

    return NextResponse.json({ assignment, notification }, { status: 201 });
  } catch (error) {
    return jsonRouteError(error, "Failed to assign event role.");
  }
}
