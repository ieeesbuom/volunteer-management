import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";
import { parseSbRole, revokeSbRole } from "@/features/access-control/server/roles";

const roleSchema = z.object({
  role: z.string(),
  userId: z.string().min(1),
  term: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = roleSchema.parse(await request.json());
    const assignment = await revokeSbRole({
      actorUserId: admin.authUser.id,
      role: parseSbRole(body.role),
      userId: body.userId,
      term: body.term,
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Role revoke failed."),
      routeErrorStatus(error),
    );
  }
}
