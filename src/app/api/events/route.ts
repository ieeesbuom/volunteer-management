import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  canCreateEvent,
  parseEventStatus,
  parseValidationBody,
  requireEventCreator,
} from "@/features/events/server/event-route-helpers";
import { createEvent, getEvents } from "@/features/events/server/event-service";
import { CreateEventInputSchema } from "@/features/events/types";
import { jsonError, jsonRouteError } from "@/server/errors";

const MAX_EVENT_LIST_LIMIT = 500;

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  if (!user.isAdmin && !canCreateEvent(user)) {
    return jsonError("Verified UoM email is required before volunteering.", 403);
  }

  const { searchParams } = new URL(request.url);
  const status = parseEventStatus(searchParams.get("status"));
  const term = searchParams.get("term")?.trim() || undefined;
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Number.isNaN(rawLimit)
    ? 50
    : Math.min(Math.max(rawLimit, 1), MAX_EVENT_LIST_LIMIT);
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

  if (searchParams.get("status") && !status) {
    return jsonError("Invalid event status filter.", 400);
  }

  try {
    const result = await getEvents({
      isAdmin: user.isAdmin,
      limit,
      offset,
      status,
      term,
      userId: user.authUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Failed to list events.");
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const authError = requireEventCreator(user);

  if (authError) {
    return authError;
  }

  const parsed = parseValidationBody(CreateEventInputSchema, await request.json());

  if ("error" in parsed && parsed.error) {
    return parsed.error;
  }

  try {
    const event = await createEvent(parsed.data, user!.authUser.id, {
      isAdmin: user!.isAdmin,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonRouteError(error, "Failed to create event.");
  }
}
