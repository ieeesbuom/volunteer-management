"use client";

import {
  Clock,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

export function StatCapsuleWidget() {
  const { user, opportunityList } = useDashboardData();

  return (
    <div className="h-full flex items-center">
      <div className="inline-flex flex-wrap items-center gap-8 sm:gap-10 rounded-full border border-border-subtle bg-surface-raised px-8 py-3 text-[13px] sm:text-[14px] w-full">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Clock className="size-4 shrink-0" />
          </div>
          <span className="font-bold text-text-strong">
            {user.profile.uomVerified ? "Verified" : "Pending"}
          </span>
          <span className="text-text-muted font-normal">Student Status</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-4 shrink-0" />
          </div>
          <span className="font-bold text-text-strong">{user.eventRoles.length}</span>
          <span className="text-text-muted font-normal">Active Responsibilities</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Hourglass className="size-4 shrink-0" />
          </div>
          <span className="font-bold text-text-strong">{opportunityList.length}</span>
          <span className="text-text-muted font-normal">Open Opportunities</span>
        </div>
      </div>
    </div>
  );
}
