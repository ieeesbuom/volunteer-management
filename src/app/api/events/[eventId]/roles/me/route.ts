import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { requireVerifiedVolunteer, requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import { getUserEventRoleAssignment } from "@/features/events/server/event-roles.server";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

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
    const { event } = await requireVisibleEvent(eventId, user!);
    const assignment = await getUserEventRoleAssignment(user!.authUser.id, eventId, event.reference);
    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Failed to fetch your event role."),
      routeErrorStatus(error),
    );
  }
}
