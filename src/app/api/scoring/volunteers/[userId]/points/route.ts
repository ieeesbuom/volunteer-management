import { NextResponse } from "next/server";
import { getVolunteerPoints } from "@/features/scoring/server/actions";
import { jsonRouteError } from "@/server/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;
    const points = await getVolunteerPoints(userId, { limit, offset });
    return NextResponse.json({ points });
  } catch (error) {
    return jsonRouteError(error, "Failed to retrieve points.");
  }
}
