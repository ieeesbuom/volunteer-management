import { NextResponse } from "next/server";
import { GradeRequestSchema } from "@/features/scoring/lib/schemas";
import { createGradeRequest, listGradeRequests } from "@/features/scoring/server/actions";
import { requireAuth } from "@/features/access-control/server/current-user";
import { notifyGradingRequestWorkflow } from "@/features/notifications/server/workflow-notifications";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = GradeRequestSchema.parse(await request.json());
    const gradeRequest = await createGradeRequest(body);
    const notificationContext = await getEventNotificationContext(gradeRequest.eventId, {
      excludeUserIds: [user.authUser.id],
      managerOnly: true,
    });
    const notifications = await notifyGradingRequestWorkflow({
      actorUserId: user.authUser.id,
      eventId: gradeRequest.eventId,
      eventTitle: notificationContext.eventTitle,
      linkHref: `/scoring?eventId=${encodeURIComponent(gradeRequest.eventId)}&role=Admin`,
      recipientUserIds: [
        gradeRequest.targetUserId,
        ...notificationContext.recipientUserIds,
      ],
    });

    return NextResponse.json({ gradeRequest, notifications });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Failed to create grade request."),
      routeErrorStatus(error)
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
    const gradeRequests = await listGradeRequests({ limit, offset });
    return NextResponse.json({ gradeRequests });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Failed to list grade requests."),
      routeErrorStatus(error)
    );
  }
}
