import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  parseValidationBody,
  requireVerifiedVolunteer,
  requireVisibleEvent,
} from "@/features/events/server/event-route-helpers";
import { ConclusionActionSchema } from "@/features/events/types";
import { jsonError, jsonRouteError } from "@/server/errors";

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
  const parsed = parseValidationBody(ConclusionActionSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    await requireVisibleEvent(eventId, user!);
    return jsonError(
      "Conclusion actions are managed through structured conclusion reports.",
      409,
    );
  } catch (error) {
    return jsonRouteError(error, "Failed to process conclusion action.");
  }
}
