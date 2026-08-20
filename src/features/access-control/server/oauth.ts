import "server-only";

import { Account, OAuthProvider } from "node-appwrite";
import { PRODUCTION_APP_ORIGIN } from "@/lib/appwrite/constants";
import { getAppwriteAdminClient, getAppwriteBaseClient } from "@/server/appwrite";
import { isInvalidOAuthRedirect } from "@/server/errors";

export function getOAuthAccount() {
  return new Account(getAppwriteBaseClient());
}

export function getOAuthSessionAccount() {
  return new Account(getAppwriteAdminClient());
}

export async function createGoogleOAuthUrl(origin: string) {
  try {
    return await requestGoogleOAuthUrl(origin);
  } catch (error) {
    if (origin !== PRODUCTION_APP_ORIGIN && isInvalidOAuthRedirect(error)) {
      return requestGoogleOAuthUrl(PRODUCTION_APP_ORIGIN);
    }

    throw error;
  }
}

function requestGoogleOAuthUrl(origin: string) {
  const account = getOAuthAccount();

  return account.createOAuth2Token({
    failure: `${origin}/login?error=oauth_failed`,
    provider: OAuthProvider.Google,
    scopes: ["email", "profile"],
    success: `${origin}/api/auth/callback`,
  });
}

export async function createSessionFromOAuthToken({
  secret,
  userId,
}: {
  secret: string;
  userId: string;
}) {
  const account = getOAuthSessionAccount();
  return account.createSession({ secret, userId });
}
