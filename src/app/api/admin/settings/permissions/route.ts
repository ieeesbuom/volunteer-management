import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import {
  getPermissionOverview,
  updateRolePermissions,
} from "@/features/system-settings/server/settings";
import { getServerEnv } from "@/lib/env";
import { jsonError, routeErrorStatus } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const permissions = await getPermissionOverview(getServerEnv().ADMIN_EMAIL);

    return NextResponse.json({ permissions });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not load permission overview.",
      routeErrorStatus(error),
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const permissions = await updateRolePermissions(user.authUser.id, body);

    return NextResponse.json({ permissions });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update permissions.",
      routeErrorStatus(error),
    );
  }
}
