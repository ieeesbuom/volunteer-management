export type DashboardWidgetType =
  | "welcome_greeting"
  | "stat_capsule"
  | "kpi_metrics_row"
  | "analytics_stacked_flow"
  | "analytics_weekly_bar"
  | "analytics_distribution_donut"
  | "analytics_growth_area"
  | "analytics_event_table"
  | "my_projects"
  | "schedule"
  | "profile_overview"
  | "leaderboard_mini"
  | "leaderboard_bar_chart"
  | "quick_links"
  | "notifications_summary";

export type DashboardLayoutItem = {
  instanceId: string;
  widgetType: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
};

export type DashboardLayout = {
  items: DashboardLayoutItem[];
  version: 1;
};

export type StoredDashboardLayout = {
  userId: string;
  layout: DashboardLayout;
  createdAt: string;
  updatedAt: string;
};
