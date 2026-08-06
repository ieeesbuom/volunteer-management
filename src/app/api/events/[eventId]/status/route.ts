import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canChangeEventStatus,
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import { updateEventStatus } from "@/features/events/server/event-service";
import { notifyEventUpdateWorkflow } from "@/features/notifications/server/workflow-notifications";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { EVENT_STATUSES } from "@/features/events/types";
import { ForbiddenError, jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

const statusUpdateSchema = z.object({
  status: z.enum(EVENT_STATUSES),
});

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  const authError = requireVerifiedVolunteer(user);

  if (authError) {
    return authError;
  }

  const { eventId } = await context.params;
  const parsed = parseValidationBody(statusUpdateSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const { event } = await requireVisibleEvent(eventId, user!);

    if (
      !canChangeEventStatus({
        event,
        newStatus: parsed.data.status,
        user: user!,
      })
    ) {
      throw new ForbiddenError("You do not have permission to change this event status.");
    }

    const updatedEvent = await updateEventStatus(eventId, parsed.data.status, {
      actorUserId: user!.authUser.id,
      allowAdminBackward: user!.isAdmin,
    });
    const notificationContext = await getEventNotificationContext(eventId, {
      excludeUserIds: [user!.authUser.id],
    });
    const notifications = await notifyEventUpdateWorkflow({
      actorUserId: user!.authUser.id,
      eventId,
      eventTitle: notificationContext.eventTitle,
      linkHref: `/events/${eventId}`,
      message: `${notificationContext.eventTitle} status changed to ${parsed.data.status.replaceAll("_", " ")}.`,
      recipientUserIds: notificationContext.recipientUserIds,
    });

    return NextResponse.json({ event: updatedEvent, notifications });
  } catch (error) {
    const message =
      routeErrorMessage(error, "Failed to update event status.");

    if (message.includes("Illegal event status transition")) {
      return jsonError(message, 400);
    }

    return jsonError(message, routeErrorStatus(error));
  }
}
