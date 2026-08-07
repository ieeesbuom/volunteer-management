"use client";

import Link from "next/link";
import { useLayoutEffect } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import { DashboardDataProvider } from "@/features/dashboard/components/dashboard-data-context";
import { WelcomeGreetingWidget } from "@/features/dashboard/components/widgets/welcome-greeting-widget";
import { StatCapsuleWidget } from "@/features/dashboard/components/widgets/stat-capsule-widget";
import { MyProjectsWidget } from "@/features/dashboard/components/widgets/my-projects-widget";
import { ScheduleWidget } from "@/features/dashboard/components/widgets/schedule-widget";
import { ProfileOverviewWidget } from "@/features/dashboard/components/widgets/profile-overview-widget";
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
        <Plus className="size-4 stroke-3" />
        <span>New Project</span>
        <ChevronDown className="size-3.5 opacity-80" />
      </Link>,
    );
    return () => setNavExtras(null);
  }, [setNavExtras, user.isAdmin]);

  return (
    <DashboardDataProvider value={{ user, opportunityList }}>
      <div className="space-y-4 pb-6 text-text-strong antialiased">
        <WelcomeGreetingWidget />
        <StatCapsuleWidget />
        <MyProjectsWidget />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-h-[280px] lg:col-span-7">
            <ScheduleWidget />
          </div>
          <div className="min-h-[280px] lg:col-span-5">
            <ProfileOverviewWidget />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-h-[240px] lg:col-span-5">
            <NotificationsSummaryWidget />
          </div>
          <div className="min-h-[240px] lg:col-span-7">
            <LeaderboardMiniWidget />
          </div>
        </div>
      </div>
    </DashboardDataProvider>
  );
}
