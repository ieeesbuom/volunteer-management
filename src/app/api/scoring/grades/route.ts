import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeGrade } from "@/features/scoring/server/actions";
import { requireAuth } from "@/features/access-control/server/current-user";
import { notifyEventUpdateWorkflow } from "@/features/notifications/server/workflow-notifications";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { jsonRouteError } from "@/server/errors";

const finalizeSchema = z.object({
  gradeRequestId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = finalizeSchema.parse(await request.json());
    const gradeRequest = await finalizeGrade(body.gradeRequestId);
    const notificationContext = await getEventNotificationContext(gradeRequest.eventId, {
      excludeUserIds: [user.authUser.id],
      managerOnly: true,
    });
    const notifications = await notifyEventUpdateWorkflow({
      actorUserId: user.authUser.id,
      eventId: gradeRequest.eventId,
      eventTitle: notificationContext.eventTitle,
      linkHref: `/scoring?eventId=${encodeURIComponent(gradeRequest.eventId)}&role=Member`,
      message: `${notificationContext.eventTitle} grading was finalized and points are available.`,
      recipientUserIds: [
        gradeRequest.targetUserId,
        ...notificationContext.recipientUserIds,
      ],
    });

    return NextResponse.json({ gradeRequest, notifications });
  } catch (error) {
    return jsonRouteError(error, "Failed to finalize grade.");
  }
}
