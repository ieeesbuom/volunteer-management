import { NextResponse } from "next/server";
import {
  createFormConnectionForCurrentUser,
  listFormConnectionsForCurrentUser,
} from "@/features/forms/server/form-connection-service";
import { requireAuth } from "@/features/access-control/server/current-user";
import {
  createFormConnectionSchema,
  listFormConnectionsQuerySchema,
} from "@/features/forms/validation";
import {
  notifyEventUpdateWorkflow,
  notifyGradingRequestWorkflow,
} from "@/features/notifications/server/workflow-notifications";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const query = listFormConnectionsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const connections = await listFormConnectionsForCurrentUser(query.eventId);

    return NextResponse.json({ connections });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load form connections.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = createFormConnectionSchema.parse(await request.json());
    const connection = await createFormConnectionForCurrentUser(body, user);
    const notificationContext = await getEventNotificationContext(connection.eventId, {
      excludeUserIds: [user.authUser.id],
    });
    const notifications =
      connection.purpose === "grading"
        ? await notifyGradingRequestWorkflow({
            actorUserId: user.authUser.id,
            eventId: connection.eventId,
            eventTitle: notificationContext.eventTitle,
            linkHref: `/events/${connection.eventId}`,
            recipientUserIds: notificationContext.recipientUserIds,
          })
        : await notifyEventUpdateWorkflow({
            actorUserId: user.authUser.id,
            eventId: connection.eventId,
            eventTitle: notificationContext.eventTitle,
            linkHref: `/events/${connection.eventId}`,
            message: `${connection.title} is now available.`,
            recipientUserIds: notificationContext.recipientUserIds,
          });

    return NextResponse.json({ connection, notifications }, { status: 201 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create form connection.",
      routeErrorStatus(error),
    );
  }
}
