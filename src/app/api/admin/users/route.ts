import { NextResponse } from "next/server";
import { listAdminUsers } from "@/features/access-control/server/admin-users";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonRouteError } from "@/server/errors";

export async function GET() {
  try {
    await requireAdmin();
    const users = await listAdminUsers();

    return NextResponse.json({ users });
  } catch (error) {
    return jsonRouteError(error, "Admin access failed.");
  }
}
