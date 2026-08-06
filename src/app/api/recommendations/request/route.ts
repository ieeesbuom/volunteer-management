import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import {
  listRecommendationRequestsForVolunteer,
  requestRecommendation,
} from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";
import {
  enforceRateLimit,
  rateLimitKey,
  RATE_LIMITS,
} from "@/server/rate-limit";

const requestSchema = z.object({
  message: z.string().trim().max(500).optional(),
  respondentId: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUomVerifiedVolunteer();
    const requests = await listRecommendationRequestsForVolunteer(user.authUser.id);

    return NextResponse.json(requests);
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Recommendation request lookup failed."),
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUomVerifiedVolunteer();
    enforceRateLimit(
      rateLimitKey("recommendation-write", user.authUser.id),
      RATE_LIMITS.recommendationWritePerUser,
    );
    const body = requestSchema.parse(await request.json());
    const recommendationRequest = await requestRecommendation({
      message: body.message,
      respondentId: body.respondentId,
      user,
    });

    return NextResponse.json({ request: recommendationRequest });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Recommendation request failed."),
      routeErrorStatus(error),
    );
  }
}
