"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";

export type DashboardDataContextValue = {
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DashboardDataContextValue;
}) {
  return (
    <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  }
  return ctx;
}
