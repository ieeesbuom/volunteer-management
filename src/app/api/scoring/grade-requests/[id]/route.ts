import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGradeRequest, submitGradeReview } from "@/features/scoring/server/actions";
import { requireAuth } from "@/features/access-control/server/current-user";
import { notifyGradingRequestWorkflow } from "@/features/notifications/server/workflow-notifications";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { jsonError, routeErrorStatus } from "@/server/errors";

const patchSchema = z.object({
  gradeValue: z.number().int().min(0).max(10),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const gradeRequest = await submitGradeReview(id, body.gradeValue);
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
      error instanceof Error ? error.message : "Failed to update grade review.",
      routeErrorStatus(error)
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteGradeRequest(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to delete grade request.",
      routeErrorStatus(error)
    );
  }
}
