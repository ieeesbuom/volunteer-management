"use client";

import { useLayoutEffect } from "react";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import { DashboardDataProvider } from "@/features/dashboard/components/dashboard-data-context";
import { WelcomeGreetingWidget } from "@/features/dashboard/components/widgets/welcome-greeting-widget";
import { VerifyUomBanner } from "@/features/dashboard/components/widgets/verify-uom-banner";
import { MyProjectsWidget } from "@/features/dashboard/components/widgets/my-projects-widget";
import { MyResponsibilitiesWidget } from "@/features/dashboard/components/widgets/my-responsibilities-widget";
import { VolunteerSearchWidget } from "@/features/dashboard/components/widgets/volunteer-search-widget";
import {
  LeaderboardMiniWidget,
  type LeaderboardPreviewEntry,
} from "@/features/dashboard/components/widgets/leaderboard-mini-widget";

interface DashboardOverviewProps {
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
  leaderboardPreview: LeaderboardPreviewEntry[];
}

export function DashboardOverview({
  user,
  opportunityList,
  leaderboardPreview,
}: DashboardOverviewProps) {
  const { setOpportunityList } = useAppPageNav();

  useLayoutEffect(() => {
    setOpportunityList(opportunityList);
    return () => setOpportunityList([]);
  }, [opportunityList, setOpportunityList]);

  return (
    <DashboardDataProvider value={{ user, opportunityList }}>
      <div className="space-y-4 pb-6 text-text-strong antialiased">
        <WelcomeGreetingWidget />
        <VerifyUomBanner />
        <MyProjectsWidget />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="flex min-h-60 max-h-[28rem] lg:col-span-6 lg:h-[28rem]">
            <MyResponsibilitiesWidget />
          </div>
          <div className="flex min-h-60 max-h-[28rem] lg:col-span-6 lg:h-[28rem]">
            <VolunteerSearchWidget />
          </div>
        </div>
        <LeaderboardMiniWidget entries={leaderboardPreview} />
      </div>
    </DashboardDataProvider>
  );
}
