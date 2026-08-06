import "server-only";

import type { Account, Models } from "node-appwrite";

type PrefsWithAvatar = Models.Preferences & {
  avatarUrl?: unknown;
};

export function readAvatarUrlFromPrefs(prefs: Models.Preferences | undefined): string | undefined {
  if (!prefs) {
    return undefined;
  }

  const value = (prefs as PrefsWithAvatar).avatarUrl;
  return typeof value === "string" && value.startsWith("https://") ? value : undefined;
}

async function fetchGoogleAvatarUrl(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { picture?: unknown };
    return typeof data.picture === "string" && data.picture.startsWith("https://")
      ? data.picture
      : null;
  } catch {
    return null;
  }
}

/**
 * Returns a cached Google avatar URL from prefs, or fetches and stores one
 * from the current OAuth session when available.
 */
export async function ensureGoogleAvatarUrl(account: Account): Promise<string | undefined> {
  const user = await account.get();
  const existing = readAvatarUrlFromPrefs(user.prefs);

  if (existing) {
    return existing;
  }

  try {
    const session = await account.getSession({ sessionId: "current" });

    if (!session.providerAccessToken) {
      return undefined;
    }

    const provider = session.provider.toLowerCase();
    if (provider && provider !== "google") {
      return undefined;
    }

    const avatarUrl = await fetchGoogleAvatarUrl(session.providerAccessToken);

    if (!avatarUrl) {
      return undefined;
    }

    await account.updatePrefs({
      ...user.prefs,
      avatarUrl,
    });

    return avatarUrl;
  } catch {
    return undefined;
  }
}
