import { NextResponse } from "next/server";
import {
  updateFormConnectionForCurrentUser,
  deleteFormConnectionForCurrentUser,
} from "@/features/forms/server/form-connection-service";
import { requireAuth } from "@/features/access-control/server/current-user";
import { updateFormConnectionSchema } from "@/features/forms/validation";
import { jsonError, routeErrorStatus } from "@/server/errors";

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { connectionId } = await context.params;
    const body = await request.json();

    const parsed = updateFormConnectionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Validation failed.", 400);
    }

    const connection = await updateFormConnectionForCurrentUser(
      connectionId,
      parsed.data,
      user,
    );

    return NextResponse.json({ connection });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update form connection.",
      routeErrorStatus(error),
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { connectionId } = await context.params;

    await deleteFormConnectionForCurrentUser(connectionId, user);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not delete form connection.",
      routeErrorStatus(error),
    );
  }
}
