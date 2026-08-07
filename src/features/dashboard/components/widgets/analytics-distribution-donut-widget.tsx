"use client";

import { WidgetEmptyState } from "@/features/dashboard/components/widgets/widget-empty-state";

export function AnalyticsDistributionDonutWidget() {
  return (
    <WidgetEmptyState
      title="No category breakdown yet"
      description="Point distribution by category will appear here once scoring analytics are connected."
    />
  );
}
