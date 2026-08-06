"use client";

import type { DashboardWidgetType } from "@/features/dashboard/types";
import { getWidgetDefinition } from "@/features/dashboard/lib/widget-registry";

export function DashboardWidgetRenderer({ widgetType }: { widgetType: DashboardWidgetType }) {
  const { Component } = getWidgetDefinition(widgetType);
  return <Component />;
}
