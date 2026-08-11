import { NextResponse } from "next/server";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { requireAuth } from "@/features/access-control/server/current-user";
import { listVerifiedVolunteers } from "@/features/volunteers/server/profiles";
import { jsonRouteError, ForbiddenError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    if (!user.isAdmin && !canVolunteer(user.profile)) {
      throw new ForbiddenError("Verified UoM email is required before volunteering.");
    }

    const { searchParams } = new URL(request.url);
    const term = searchParams.get("q") ?? "";
    const limit = Number(searchParams.get("limit") ?? "50");
    const offset = Number(searchParams.get("offset") ?? "0");

    const result = await listVerifiedVolunteers({
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      term,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Could not load volunteers.");
  }
}
