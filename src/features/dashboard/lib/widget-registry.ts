import type { ComponentType } from "react";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardWidgetType } from "@/features/dashboard/types";
import { WelcomeGreetingWidget } from "@/features/dashboard/components/widgets/welcome-greeting-widget";
import { StatCapsuleWidget } from "@/features/dashboard/components/widgets/stat-capsule-widget";
import { KPIMetricsWidget } from "@/features/dashboard/components/widgets/kpi-metrics-widget";
import { AnalyticsStackedFlowWidget } from "@/features/dashboard/components/widgets/analytics-stacked-flow-widget";
import { AnalyticsWeeklyBarWidget } from "@/features/dashboard/components/widgets/analytics-weekly-bar-widget";
import { AnalyticsDistributionDonutWidget } from "@/features/dashboard/components/widgets/analytics-distribution-donut-widget";
import { AnalyticsGrowthAreaWidget } from "@/features/dashboard/components/widgets/analytics-growth-area-widget";
import { AnalyticsEventTableWidget } from "@/features/dashboard/components/widgets/analytics-event-table-widget";
import { MyProjectsWidget } from "@/features/dashboard/components/widgets/my-projects-widget";
import { ScheduleWidget } from "@/features/dashboard/components/widgets/schedule-widget";
import { ProfileOverviewWidget } from "@/features/dashboard/components/widgets/profile-overview-widget";
import { LeaderboardMiniWidget } from "@/features/dashboard/components/widgets/leaderboard-mini-widget";
import { LeaderboardBarChartWidget } from "@/features/dashboard/components/widgets/leaderboard-bar-chart-widget";
import { QuickLinksWidget } from "@/features/dashboard/components/widgets/quick-links-widget";
import { NotificationsSummaryWidget } from "@/features/dashboard/components/widgets/notifications-summary-widget";

export type WidgetCatalogCategory =
  | "Overview"
  | "Analytics"
  | "Scoring"
  | "Navigation"
  | "Notifications";

export type WidgetDefinition = {
  type: DashboardWidgetType;
  title: string;
  description: string;
  category: WidgetCatalogCategory;
  defaultSize: { w: number; h: number; minW: number; minH: number };
  adminOnly?: boolean;
  Component: ComponentType;
};

export const WIDGET_REGISTRY: Record<DashboardWidgetType, WidgetDefinition> = {
  welcome_greeting: {
    type: "welcome_greeting",
    title: "Welcome Greeting",
    description: "Header banner with time-aware greeting and date.",
    category: "Overview",
    defaultSize: { w: 12, h: 2, minW: 6, minH: 2 },
    Component: WelcomeGreetingWidget,
  },
  stat_capsule: {
    type: "stat_capsule",
    title: "Status capsule",
    description: "Verification, responsibilities, and open opportunities at a glance.",
    category: "Overview",
    defaultSize: { w: 12, h: 2, minW: 6, minH: 2 },
    Component: StatCapsuleWidget,
  },
  kpi_metrics_row: {
    type: "kpi_metrics_row",
    title: "KPI Metrics Row",
    description: "Key performance indicators for volunteer hours, points, and active rate with growth trend pills.",
    category: "Analytics",
    defaultSize: { w: 12, h: 3, minW: 6, minH: 2 },
    Component: KPIMetricsWidget,
  },
  analytics_stacked_flow: {
    type: "analytics_stacked_flow",
    title: "Impact Stacked Bar Chart",
    description: "Multi-layered category contribution stacked bar chart with growth metrics.",
    category: "Analytics",
    defaultSize: { w: 8, h: 6, minW: 5, minH: 4 },
    Component: AnalyticsStackedFlowWidget,
  },
  analytics_weekly_bar: {
    type: "analytics_weekly_bar",
    title: "Weekly Activity Bar Chart",
    description: "Day-by-day activity bar chart with highlighted peak engagement badge.",
    category: "Analytics",
    defaultSize: { w: 4, h: 6, minW: 3, minH: 4 },
    Component: AnalyticsWeeklyBarWidget,
  },
  analytics_distribution_donut: {
    type: "analytics_distribution_donut",
    title: "Category Distribution Donut",
    description: "Semi-circle gauge chart showing distribution breakdown by category.",
    category: "Analytics",
    defaultSize: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: AnalyticsDistributionDonutWidget,
  },
  analytics_growth_area: {
    type: "analytics_growth_area",
    title: "Participation Growth Area Chart",
    description: "Smooth continuous area chart tracking volunteer hours and growth trend.",
    category: "Analytics",
    defaultSize: { w: 6, h: 5, minW: 4, minH: 4 },
    Component: AnalyticsGrowthAreaWidget,
  },
  analytics_event_table: {
    type: "analytics_event_table",
    title: "Event Impact Table",
    description: "Table of event completions, progress bars, and awarded points.",
    category: "Analytics",
    defaultSize: { w: 6, h: 6, minW: 4, minH: 4 },
    Component: AnalyticsEventTableWidget,
  },
  my_projects: {
    type: "my_projects",
    title: "My projects",
    description: "Open volunteer registration opportunities.",
    category: "Overview",
    defaultSize: { w: 12, h: 6, minW: 6, minH: 4 },
    Component: MyProjectsWidget,
  },
  schedule: {
    type: "schedule",
    title: "Schedule",
    description: "Week view and your assigned event responsibilities.",
    category: "Overview",
    defaultSize: { w: 7, h: 7, minW: 4, minH: 5 },
    Component: ScheduleWidget,
  },
  profile_overview: {
    type: "profile_overview",
    title: "Profile overview",
    description: "Verification, account status, and SB roles.",
    category: "Overview",
    defaultSize: { w: 5, h: 7, minW: 4, minH: 5 },
    Component: ProfileOverviewWidget,
  },
  leaderboard_mini: {
    type: "leaderboard_mini",
    title: "Top volunteers",
    description: "Compact leaderboard standings with top 3 podium.",
    category: "Scoring",
    defaultSize: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: LeaderboardMiniWidget,
  },
  leaderboard_bar_chart: {
    type: "leaderboard_bar_chart",
    title: "Points distribution chart",
    description: "Ranked horizontal bar chart of volunteer points.",
    category: "Scoring",
    defaultSize: { w: 6, h: 7, minW: 4, minH: 5 },
    Component: LeaderboardBarChartWidget,
  },
  quick_links: {
    type: "quick_links",
    title: "Quick links",
    description: "Shortcuts to events, leaderboard, and profile.",
    category: "Navigation",
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
    Component: QuickLinksWidget,
  },
  notifications_summary: {
    type: "notifications_summary",
    title: "Notifications",
    description: "Recent in-app notifications.",
    category: "Notifications",
    defaultSize: { w: 4, h: 5, minW: 3, minH: 4 },
    Component: NotificationsSummaryWidget,
  },
};

export function listWidgetsForUser(user: SessionUser): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((widget) => !widget.adminOnly || user.isAdmin);
}

export function getWidgetDefinition(type: DashboardWidgetType): WidgetDefinition {
  return WIDGET_REGISTRY[type];
}

export function createLayoutItemForWidget(
  widgetType: DashboardWidgetType,
  instanceId: string,
  position?: { x: number; y: number },
) {
  const def = getWidgetDefinition(widgetType);
  return {
    instanceId,
    widgetType,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    w: def.defaultSize.w,
    h: def.defaultSize.h,
  };
}

export function nextAvailableY(items: { y: number; h: number }[]) {
  if (items.length === 0) {
    return 0;
  }
  return Math.max(...items.map((item) => item.y + item.h));
}
