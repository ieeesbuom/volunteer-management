import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { listProfiles } from "@/features/access-control/server/profiles";
import { jsonRouteError } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const profiles = (await listProfiles()).filter((profile) => profile.status === "ACTIVE");

    return NextResponse.json({ profiles });
  } catch (error) {
    return jsonRouteError(error, "Could not load profiles.");
  }
}
