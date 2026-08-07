"use client";

import { WidgetEmptyState } from "@/features/dashboard/components/widgets/widget-empty-state";

export function AnalyticsGrowthAreaWidget() {
  return (
    <WidgetEmptyState
      title="No growth trend yet"
      description="Participation growth over time will appear here when historical analytics are available."
    />
  );
}
