import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonRouteError } from "@/server/errors";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";

export async function GET() {
  try {
    await requireAdmin();
    const assignments = await listActiveEventRoleAssignments();

    return NextResponse.json({ assignments });
  } catch (error) {
    return jsonRouteError(error, "Admin access failed.");
  }
}
