import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { mergeSbRoles, resolveIsAdmin } from "@/features/access-control/lib/appwrite-labels";
import { canVolunteer, hasEventRole, hasSbRole } from "@/features/access-control/lib/rules";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { readAvatarUrlFromPrefs } from "@/features/access-control/server/google-avatar";
import { resolveAuthAvatarUrl } from "@/features/access-control/server/profile-avatar";
import { getOrCreateProfile } from "@/features/access-control/server/profiles";
import { getActiveEventRoleAssignments, getActiveSbRoles } from "@/features/access-control/server/roles";
import { getSessionSecret } from "@/server/session";
import { getSupabaseServerClient } from "@/server/supabase";
import type { EventRole, SbRole, SessionUser } from "@/features/access-control/types";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const env = getServerEnv();
    let authUserRecord: { id: string; email: string; name: string; labels: string[]; prefs: Record<string, unknown> } | null = null;

    // 1. Try Supabase session
    try {
      const supabase = await getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        authUserRecord = {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
          labels: Array.isArray(user.user_metadata?.labels) ? user.user_metadata.labels : [],
          prefs: (user.user_metadata?.prefs ?? {}) as Record<string, unknown>,
        };
      }
    } catch {
      // Ignore in non-Supabase cookie environment
    }

    // 2. Fallback to sessionSecret (e.g. tests or legacy session cookie)
    if (!authUserRecord) {
        const sessionSecret = await getSessionSecret();
        if (sessionSecret) {
          const { account } = getAppwriteSessionServices(sessionSecret);
          const appUser = await account.get();
          if (appUser) {
            authUserRecord = {
              id: appUser.$id,
              email: appUser.email,
              name: appUser.name ?? "",
              labels: Array.isArray(appUser.labels) ? appUser.labels : [],
              prefs: appUser.prefs ?? {},
            };
          }
        }
      }

      if (!authUserRecord) {
        return null;
      }

      const labels = authUserRecord.labels;
      const cachedAvatarUrl = readAvatarUrlFromPrefs(authUserRecord.prefs);
      const mockAppwriteUser = {
        $id: authUserRecord.id,
        email: authUserRecord.email,
        name: authUserRecord.name,
        labels: authUserRecord.labels,
        prefs: authUserRecord.prefs,
      };

      const [profile, tableSbRoles, eventRoles] = await Promise.all([
        getOrCreateProfile(mockAppwriteUser as unknown as Parameters<typeof getOrCreateProfile>[0]),
        getActiveSbRoles(authUserRecord.id),
        getActiveEventRoleAssignments(authUserRecord.id, { includeChairCounts: false }),
      ]);

      return {
        authUser: {
          avatarUrl: resolveAuthAvatarUrl({
            avatarFileId: profile.avatarFileId,
            googleAvatarUrl: cachedAvatarUrl,
            userId: authUserRecord.id,
          }),
          email: authUserRecord.email,
          id: authUserRecord.id,
          name: authUserRecord.name,
        },
        eventRoles,
        isAdmin: resolveIsAdmin({
          adminEmail: env.ADMIN_EMAIL,
          email: authUserRecord.email,
          labels,
        }),
        labels,
        profile,
        sbRoles: mergeSbRoles(tableSbRoles, labels),
      };
    } catch {
      return null;
    }
  });

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (user.profile.status === "DISABLED") {
    throw new Error("This account has been disabled.");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();

  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  return user;
}

export async function requireUomVerifiedVolunteer() {
  const user = await requireAuth();

  if (!canVolunteer(user.profile)) {
    throw new Error("Verified UoM email is required before volunteering.");
  }

  return user;
}

export async function requireSbRole(roles: SbRole | SbRole[]) {
  const user = await requireAuth();

  if (!hasSbRole(user, roles)) {
    throw new Error("Required Student Branch role is missing.");
  }

  return user;
}

  export async function requireEventRole(
    eventId: string,
    roles: EventRole | EventRole[],
  ) {
    const user = await requireAuth();

    if (!hasEventRole(user, eventId, roles)) {
      throw new Error("Required event role is missing.");
    }

    return user;
  }

    export async function requireAdminOrRedirect(
      redirectPath = "/dashboard?error=admin_required",
    ) {
      const user = await getCurrentUser();

      if (!user) {
        redirect("/login");
      }

      if (!user.isAdmin) {
        redirect(redirectPath);
      }

      return user;
    }
