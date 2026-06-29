import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  listEventParticipationRoster,
  upsertEventParticipationRecords,
} from "@/features/scoring/server/participation";
import { UpsertParticipationRecordsSchema } from "@/features/scoring/lib/schemas";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  const { eventId } = await context.params;

  try {
    const roster = await listEventParticipationRoster({ eventId, user });
    return NextResponse.json({ roster });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load participation records.",
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  const { eventId } = await context.params;

  try {
    const body = UpsertParticipationRecordsSchema.parse(await request.json());
    const records = await upsertEventParticipationRecords({
      actor: user,
      eventId,
      records: body.records,
    });

    return NextResponse.json({ records });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not save participation records.",
      routeErrorStatus(error),
    );
  }
}

