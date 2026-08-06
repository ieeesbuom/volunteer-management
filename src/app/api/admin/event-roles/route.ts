import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError , routeErrorMessage} from "@/server/errors";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";

export async function GET() {
  try {
    await requireAdmin();
    const assignments = await listActiveEventRoleAssignments();

    return NextResponse.json({ assignments });
  } catch (error) {
    return jsonError(routeErrorMessage(error, "Admin access failed."), 403);
  }
}
