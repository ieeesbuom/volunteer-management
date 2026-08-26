import "server-only";

import {
  buildSyncedLabels,
  resolveIsAdmin,
} from "@/features/access-control/lib/appwrite-labels";
import { getActiveSbRoles } from "@/features/access-control/server/roles";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";

function labelsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((label, index) => label === sortedRight[index]);
}

/**
 * Best-effort sync of managed Auth labels from table + ADMIN_EMAIL truth.
 * Never throws — table writes must succeed even if label sync fails.
 * Event roles are never written to labels.
 */
export async function syncManagedAuthLabels(userId: string): Promise<void> {
  try {
    const env = getServerEnv();
    const { users } = getAppwriteAdminServices();
    const [authUser, tableSbRoles] = await Promise.all([
      users.get(userId),
      getActiveSbRoles(userId),
    ]);
    const currentLabels = Array.isArray(authUser.labels) ? authUser.labels : [];
    const isAdmin = resolveIsAdmin({
      adminEmail: env.ADMIN_EMAIL,
      email: authUser.email,
      labels: currentLabels,
    });
    const nextLabels = buildSyncedLabels({
      currentLabels,
      isAdmin,
      sbRoles: tableSbRoles,
    });

    if (labelsEqual(currentLabels, nextLabels)) {
      return;
    }

    await users.updateLabels({
      labels: nextLabels,
      userId,
    });
  } catch (error) {
    console.error("[auth-labels] Failed to sync managed labels for user", userId, error);
  }
}
