import type { DashboardWidgetType } from "@/features/dashboard/types";

export const DASHBOARD_WIDGET_TYPES = [
  "welcome_greeting",
  "stat_capsule",
  "kpi_metrics_row",
  "analytics_stacked_flow",
  "analytics_weekly_bar",
  "analytics_distribution_donut",
  "analytics_growth_area",
  "analytics_event_table",
  "my_projects",
  "schedule",
  "profile_overview",
  "leaderboard_mini",
  "leaderboard_bar_chart",
  "quick_links",
  "notifications_summary",
] as const satisfies readonly DashboardWidgetType[];

export function isDashboardWidgetType(value: string): value is DashboardWidgetType {
  return (DASHBOARD_WIDGET_TYPES as readonly string[]).includes(value);
}
