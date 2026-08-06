import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import { reportRecommendation } from "@/features/recommendations/server/recommendations";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";

const reportSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  recommendationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUomVerifiedVolunteer();
    enforceRateLimit(
      rateLimitKey("recommendation-write", user.authUser.id),
      RATE_LIMITS.recommendationWritePerUser,
    );
    const body = reportSchema.parse(await request.json());
    const recommendation = await reportRecommendation({
      actorUserId: user.authUser.id,
      reason: body.reason,
      recommendationId: body.recommendationId,
    });

    return NextResponse.json({ recommendation });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Recommendation report failed."),
      routeErrorStatus(error),
    );
  }
}
