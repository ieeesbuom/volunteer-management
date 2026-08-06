import "server-only";

import { requireAuth } from "@/features/access-control/server/current-user";
import { createAppwriteDashboardLayoutRepository } from "@/features/dashboard/server/dashboard-layout-repository";
import { normalizeLayoutForSave } from "@/features/dashboard/lib/default-layout";
import { dashboardLayoutSchema } from "@/features/dashboard/validation";
import type { DashboardLayout } from "@/features/dashboard/types";

function getRepository() {
  return createAppwriteDashboardLayoutRepository();
}

export async function getDashboardLayoutForCurrentUser() {
  const user = await requireAuth();
  const stored = await getRepository().getByUserId(user.authUser.id);
  return stored?.layout ?? null;
}

export async function upsertDashboardLayoutForCurrentUser(input: unknown) {
  const user = await requireAuth();
  const layout = dashboardLayoutSchema.parse(input);
  const normalized = normalizeLayoutForSave(layout);

  return getRepository().upsert({
    userId: user.authUser.id,
    layout: normalized,
  });
}

export async function getDashboardLayoutForUserId(userId: string) {
  const stored = await getRepository().getByUserId(userId);
  return stored?.layout ?? null;
}

export async function saveDashboardLayoutForUserId(userId: string, layout: DashboardLayout) {
  const normalized = normalizeLayoutForSave(dashboardLayoutSchema.parse(layout));
  return getRepository().upsert({ userId, layout: normalized });
}
