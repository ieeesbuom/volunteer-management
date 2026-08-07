import type { DashboardLayout } from "@/features/dashboard/types";

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  items: [
    {
      instanceId: "default-greeting",
      widgetType: "welcome_greeting",
      x: 0,
      y: 0,
      w: 12,
      h: 2,
    },
    {
      instanceId: "default-stat-capsule",
      widgetType: "stat_capsule",
      x: 0,
      y: 2,
      w: 12,
      h: 2,
    },
    {
      instanceId: "default-my-projects",
      widgetType: "my_projects",
      x: 0,
      y: 4,
      w: 12,
      h: 7,
    },
    {
      instanceId: "default-schedule",
      widgetType: "schedule",
      x: 0,
      y: 11,
      w: 7,
      h: 7,
    },
    {
      instanceId: "default-profile-overview",
      widgetType: "profile_overview",
      x: 7,
      y: 11,
      w: 5,
      h: 7,
    },
    {
      instanceId: "default-notifications",
      widgetType: "notifications_summary",
      x: 0,
      y: 18,
      w: 5,
      h: 5,
    },
    {
      instanceId: "default-leaderboard",
      widgetType: "leaderboard_mini",
      x: 5,
      y: 18,
      w: 7,
      h: 5,
    },
  ],
};

/** Strip client-only min fields before persistence. */
export function normalizeLayoutForSave(layout: DashboardLayout): DashboardLayout {
  return {
    version: layout.version,
    items: layout.items.map(({ config, h, instanceId, w, widgetType, x, y }) => ({
      instanceId,
      widgetType,
      x,
      y,
      w,
      h,
      ...(config && Object.keys(config).length > 0 ? { config } : {}),
    })),
  };
}
