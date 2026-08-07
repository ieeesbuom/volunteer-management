"use client";

import { WidgetEmptyState } from "@/features/dashboard/components/widgets/widget-empty-state";

export function KPIMetricsWidget() {
  return (
    <WidgetEmptyState
      title="KPI metrics unavailable"
      description="Volunteer hours, points, and active-rate summaries will appear here when analytics are connected to live scoring data."
    />
  );
}
