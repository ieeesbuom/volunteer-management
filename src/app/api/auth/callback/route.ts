import { NextResponse } from "next/server";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { createSessionFromOAuthToken } from "@/features/access-control/server/oauth";
import { bootstrapProfile } from "@/features/access-control/server/profiles";
import {
  applySessionSecretCookie,
  clearOAuthLoginNonceCookie,
  clearSessionSecret,
  clearSessionSecretCookie,
  readOAuthLoginNonce,
} from "@/server/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  let sessionSecret: string | null = null;

  if (!userId || !secret) {
    return NextResponse.redirect(new URL("/login?error=missing_callback", url.origin));
  }

  const oauthNonce = await readOAuthLoginNonce();

  if (!oauthNonce) {
    return NextResponse.redirect(new URL("/login?error=oauth_state_missing", url.origin));
  }

  try {
    const session = await createSessionFromOAuthToken({ secret, userId });

    if (!session.secret) {
      const response = NextResponse.redirect(
        new URL("/login?error=session_secret_missing", url.origin),
      );
      clearOAuthLoginNonceCookie(response);
      return response;
    }

    sessionSecret = session.secret;
    const { account } = getAppwriteSessionServices(sessionSecret);
    await bootstrapProfile(await account.get());

    const response = NextResponse.redirect(new URL("/dashboard", url.origin));
    clearOAuthLoginNonceCookie(response);
    applySessionSecretCookie(response, sessionSecret, session.expire);
    return response;
  } catch (error) {
    if (sessionSecret) {
      try {
        const { account } = getAppwriteSessionServices(sessionSecret);
        await account.deleteSession("current");
      } catch {
        // The callback may have failed because the session was already unusable.
      }
    }

    await clearSessionSecret();
    logAuthCallbackFailure(error);
    const response = NextResponse.redirect(new URL("/login?error=callback_failed", url.origin));
    clearOAuthLoginNonceCookie(response);
    clearSessionSecretCookie(response);
    return response;
  }
}

function logAuthCallbackFailure(error: unknown) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          status: "code" in error ? error.code : undefined,
          type: "type" in error ? error.type : undefined,
        }
      : { message: "Unknown callback failure" };

  console.error("[auth/callback] Google OAuth callback failed", details);
}
