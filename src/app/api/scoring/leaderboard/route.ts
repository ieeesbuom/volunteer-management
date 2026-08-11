import { NextResponse } from "next/server";
import { getLeaderboard } from "@/features/scoring/server/actions";
import { requireAuth } from "@/features/access-control/server/current-user";
import { jsonRouteError } from "@/server/errors";
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    enforceRateLimit(
      rateLimitKey("leaderboard", user.authUser.id),
      RATE_LIMITS.leaderboardPerUser,
    );
    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term") || undefined;
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    const month = monthStr ? Number(monthStr) : undefined;
    const year = yearStr ? Number(yearStr) : undefined;

    const leaderboard = await getLeaderboard({ term, month, year });
    return NextResponse.json({ leaderboard });
  } catch (error) {
    return jsonRouteError(error, "Failed to retrieve leaderboard.");
  }
}
