"use client";

import { useState } from "react";
import { Info, ArrowUpRight, ArrowDownRight, Clock, Award, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type KPICardProps = {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  icon: React.ReactNode;
  description: string;
};

function KPICard({ title, value, trend, isPositive, icon, description }: KPICardProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative flex-1 rounded-2xl border border-border-subtle bg-surface-raised p-5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-bg-base text-text-strong border border-border-subtle">
            {icon}
          </div>
          <span className="text-[13px] font-medium text-text-muted">{title}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className="text-text-placeholder hover:text-primary transition-colors cursor-pointer p-1 rounded-lg hover:bg-bg-base"
          title="Metric details"
        >
          <Info className="size-4" />
        </button>
      </div>

      {showInfo && (
        <div className="absolute top-12 right-4 z-30 w-64 rounded-xl border border-border-subtle bg-surface-overlay/95 backdrop-blur-md p-3 shadow-lg text-[12px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between font-bold text-text-strong">
            <span>{title}</span>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="text-text-placeholder hover:text-text-strong cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-text-muted text-[11px] leading-relaxed">{description}</p>
        </div>
      )}

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-text-strong tabular-nums">
          {value}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums border",
            isPositive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
              : "bg-rose-50 text-rose-700 border-rose-200/80",
          )}
        >
          {trend}
          {isPositive ? (
            <ArrowUpRight className="size-3.5 stroke-[2.5]" />
          ) : (
            <ArrowDownRight className="size-3.5 stroke-[2.5]" />
          )}
        </span>
      </div>
    </div>
  );
}

export function KPIMetricsWidget() {
  return (
    <div className="h-full w-full flex flex-col sm:flex-row gap-4">
      <KPICard
        title="Total Hours Contributed"
        value="14,250 hrs"
        trend="15.8%"
        isPositive={true}
        icon={<Clock className="size-4 text-primary" />}
        description="Calculated from logged volunteer attendance and activity forms during the current academic term."
      />
      <KPICard
        title="Total Points Earned"
        value="38,490 pts"
        trend="8.3%"
        isPositive={true}
        icon={<Award className="size-4 text-amber-500" />}
        description="Cumulative scoring points awarded to volunteers based on event performance and committee roles."
      />
      <KPICard
        title="Active Volunteer Rate"
        value="86.5%"
        trend="2.4%"
        isPositive={true}
        icon={<Users className="size-4 text-emerald-600" />}
        description="Percentage of verified volunteers who contributed at least 5 hours in the past 30 days."
      />
    </div>
  );
}
