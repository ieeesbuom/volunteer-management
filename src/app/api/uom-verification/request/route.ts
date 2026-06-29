import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/features/access-control/server/current-user";
import { jsonError, routeErrorStatus } from "@/server/errors";
import { requestUomVerification } from "@/features/access-control/server/uom-verification";
import { isUomEmail, UOM_EMAIL_DOMAIN } from "@/lib/config";

const requestSchema = z.object({
  uomEmail: z
    .string()
    .trim()
    .email()
    .refine((email) => isUomEmail(email), {
      message: `Use your University of Moratuwa email ending with @${UOM_EMAIL_DOMAIN}.`,
    }),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = requestSchema.parse(await request.json());
    const result = await requestUomVerification({
      uomEmail: body.uomEmail,
      userId: user.authUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Verification request failed.",
      routeErrorStatus(error),
    );
  }
}
