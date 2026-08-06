import { NextResponse } from "next/server";
import { createGoogleOAuthUrl } from "@/features/access-control/server/oauth";
import { jsonError, routeErrorMessage } from "@/server/errors";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { applyOAuthLoginNonceCookie, createOAuthLoginNonce } from "@/server/session";

export async function GET(request: Request) {
  try {
    enforceRateLimit(
      rateLimitKey("auth-google", getClientIp(request)),
      RATE_LIMITS.authGooglePerIp,
    );
    const authUrl = await createGoogleOAuthUrl(new URL(request.url).origin);
    const response = NextResponse.redirect(authUrl);
    applyOAuthLoginNonceCookie(response, createOAuthLoginNonce());
    return response;
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Unable to start Google login."),
      500,
    );
  }
}
