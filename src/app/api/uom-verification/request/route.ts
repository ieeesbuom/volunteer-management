import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/features/access-control/server/current-user";
import { jsonRouteError } from "@/server/errors";
import { requestUomVerification } from "@/features/access-control/server/uom-verification";
import { isUomEmail, UOM_EMAIL_DOMAIN } from "@/lib/config";
import {
  enforceRateLimit,
  rateLimitKey,
  RATE_LIMITS,
} from "@/server/rate-limit";

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
    const userKey = rateLimitKey("uom-verify-request", user.authUser.id);
    enforceRateLimit(userKey, RATE_LIMITS.uomVerificationRequestPerUser);
    const body = requestSchema.parse(await request.json());
    const result = await requestUomVerification({
      uomEmail: body.uomEmail,
      userId: user.authUser.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonRouteError(error, "Verification request failed.");
  }
}
