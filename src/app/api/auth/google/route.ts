import { NextResponse } from "next/server";
import { createGoogleOAuthUrl } from "@/features/access-control/server/oauth";
import { assertAppwriteApiKeyAuthorized } from "@/server/appwrite";
import { isAppwriteUnauthorized } from "@/server/errors";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { getPublicAppOrigin } from "@/server/public-origin";
import { applyOAuthLoginNonceCookie, createOAuthLoginNonce } from "@/server/session";

export async function GET(request: Request) {
  const origin = getPublicAppOrigin(request);

  try {
    enforceRateLimit(
      rateLimitKey("auth-google", getClientIp(request)),
      RATE_LIMITS.authGooglePerIp,
    );
    await assertAppwriteApiKeyAuthorized();
    const authUrl = await createGoogleOAuthUrl(origin);
    const response = NextResponse.redirect(authUrl);
    applyOAuthLoginNonceCookie(response, createOAuthLoginNonce());
    return response;
  } catch (error) {
    if (
      (error instanceof Error && error.message === "APPWRITE_API_KEY_UNAUTHORIZED")
      || isAppwriteUnauthorized(error)
    ) {
      return NextResponse.redirect(new URL("/login?error=api_key_unauthorized", origin));
    }

    logAuthStartFailure(error);
    return NextResponse.redirect(new URL("/login?error=oauth_start_failed", origin));
  }
}

function logAuthStartFailure(error: unknown) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          status: "code" in error ? error.code : undefined,
          type: "type" in error ? error.type : undefined,
        }
      : { message: "Unknown OAuth start failure" };

  console.error("[auth/google] Unable to start Google login", details);
}
