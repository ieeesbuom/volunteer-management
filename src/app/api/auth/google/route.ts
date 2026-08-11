import { NextResponse } from "next/server";
import { createGoogleOAuthUrl } from "@/features/access-control/server/oauth";
import { assertAppwriteApiKeyAuthorized } from "@/server/appwrite";
import { jsonRouteError } from "@/server/errors";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { applyOAuthLoginNonceCookie, createOAuthLoginNonce } from "@/server/session";

export async function GET(request: Request) {
  try {
    enforceRateLimit(
      rateLimitKey("auth-google", getClientIp(request)),
      RATE_LIMITS.authGooglePerIp,
    );
    await assertAppwriteApiKeyAuthorized();
    const authUrl = await createGoogleOAuthUrl(new URL(request.url).origin);
    const response = NextResponse.redirect(authUrl);
    applyOAuthLoginNonceCookie(response, createOAuthLoginNonce());
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "APPWRITE_API_KEY_UNAUTHORIZED") {
      return NextResponse.redirect(
        new URL("/login?error=api_key_unauthorized", new URL(request.url).origin),
      );
    }

    return jsonRouteError(error, "Unable to start Google login.", 500);
  }
}
