"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import { Plus } from "lucide-react";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import { DashboardDataProvider } from "@/features/dashboard/components/dashboard-data-context";
import { WelcomeGreetingWidget } from "@/features/dashboard/components/widgets/welcome-greeting-widget";
import { VerifyUomBanner } from "@/features/dashboard/components/widgets/verify-uom-banner";
import { MyProjectsWidget } from "@/features/dashboard/components/widgets/my-projects-widget";
import { MyResponsibilitiesWidget } from "@/features/dashboard/components/widgets/my-responsibilities-widget";
import { NotificationsSummaryWidget } from "@/features/dashboard/components/widgets/notifications-summary-widget";
import { LeaderboardMiniWidget } from "@/features/dashboard/components/widgets/leaderboard-mini-widget";

interface DashboardOverviewProps {
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
}

export function DashboardOverview({ user, opportunityList }: DashboardOverviewProps) {
  const { setNavExtras, setOpportunityList } = useAppPageNav();

  useLayoutEffect(() => {
    setOpportunityList(opportunityList);
    return () => setOpportunityList([]);
  }, [opportunityList, setOpportunityList]);

  useLayoutEffect(() => {
    if (!user.isAdmin) {
      setNavExtras(null);
      return;
    }

    setNavExtras(
      <Link
        href="/events/new"
        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-semibold text-white transition-all hover:bg-primary-hover"
      >
        <Plus className="size-4" aria-hidden />
        <span>New Project</span>
      </Link>,
    );
    return () => setNavExtras(null);
  }, [setNavExtras, user.isAdmin]);

  return (
    <DashboardDataProvider value={{ user, opportunityList }}>
      <div className="space-y-4 pb-6 text-text-strong antialiased">
        <WelcomeGreetingWidget />
        <VerifyUomBanner />
        <MyProjectsWidget />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-h-[240px] lg:col-span-6">
            <MyResponsibilitiesWidget />
          </div>
          <div className="min-h-[240px] lg:col-span-6">
            <NotificationsSummaryWidget />
          </div>
        </div>
        <LeaderboardMiniWidget />
      </div>
    </DashboardDataProvider>
  );
}
