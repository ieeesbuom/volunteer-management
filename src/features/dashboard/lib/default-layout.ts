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
      instanceId: "default-kpi-metrics",
      widgetType: "kpi_metrics_row",
      x: 0,
      y: 2,
      w: 12,
      h: 3,
    },
    {
      instanceId: "default-stacked-flow",
      widgetType: "analytics_stacked_flow",
      x: 0,
      y: 5,
      w: 8,
      h: 6,
    },
    {
      instanceId: "default-weekly-bar",
      widgetType: "analytics_weekly_bar",
      x: 8,
      y: 5,
      w: 4,
      h: 6,
    },
    {
      instanceId: "default-donut-distribution",
      widgetType: "analytics_distribution_donut",
      x: 0,
      y: 11,
      w: 6,
      h: 5,
    },
    {
      instanceId: "default-growth-area",
      widgetType: "analytics_growth_area",
      x: 6,
      y: 11,
      w: 6,
      h: 5,
    },
    {
      instanceId: "default-my-projects",
      widgetType: "my_projects",
      x: 0,
      y: 16,
      w: 12,
      h: 7,
    },
    {
      instanceId: "default-schedule",
      widgetType: "schedule",
      x: 0,
      y: 23,
      w: 7,
      h: 7,
    },
    {
      instanceId: "default-profile-overview",
      widgetType: "profile_overview",
      x: 7,
      y: 23,
      w: 5,
      h: 7,
    },
    {
      instanceId: "default-notifications",
      widgetType: "notifications_summary",
      x: 0,
      y: 30,
      w: 5,
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
