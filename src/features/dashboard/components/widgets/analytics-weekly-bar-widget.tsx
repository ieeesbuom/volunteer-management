"use client";

import { WidgetEmptyState } from "@/features/dashboard/components/widgets/widget-empty-state";

export function AnalyticsWeeklyBarWidget() {
  return (
    <WidgetEmptyState
      title="No volunteer hours yet"
      description="Weekly activity charts will appear here when hour tracking data is available."
    />
  );
}
