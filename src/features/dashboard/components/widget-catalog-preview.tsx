"use client";

import type { DashboardWidgetType } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

const PREVIEW_SAMPLE = {
  names: ["Alex M.", "Sam K.", "Jordan L.", "Riley P."],
  points: [420, 380, 290, 210],
};

function PreviewFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border-subtle bg-surface-raised",
        className,
      )}
    >
      <div className="pointer-events-none select-none">{children}</div>
      <div
        className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface-raised via-surface-raised/80 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function StatCapsulePreview() {
  return (
    <div className="p-3">
      <div className="flex flex-wrap gap-3 rounded-full border border-border-subtle bg-bg-base px-4 py-2 text-[10px]">
        <span className="font-semibold text-text-strong">Verified</span>
        <span className="text-text-muted">3 roles</span>
        <span className="text-text-muted">2 open</span>
      </div>
    </div>
  );
}

function KPIMetricsPreview() {
  return (
    <div className="p-2.5 grid grid-cols-3 gap-1.5">
      {[
        { val: "14,250", label: "Hours", badge: "+15%" },
        { val: "38,490", label: "Points", badge: "+8%" },
        { val: "86.5%", label: "Active", badge: "+2%" },
      ].map((kpi) => (
        <div key={kpi.label} className="rounded-lg border border-border-subtle bg-bg-base p-1.5 text-[9px]">
          <span className="text-[8px] text-text-muted font-medium truncate block">{kpi.label}</span>
          <span className="font-extrabold text-text-strong block mt-0.5">{kpi.val}</span>
          <span className="inline-block mt-1 rounded bg-emerald-50 text-emerald-700 text-[7px] font-bold px-1 py-0.2">
            {kpi.badge}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsStackedFlowPreview() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex justify-between items-center text-[9px]">
        <span className="font-bold text-text-strong">18,450 pts</span>
        <span className="rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 font-bold text-[8px]">
          +15.8% ↗
        </span>
      </div>
      <div className="flex items-end justify-around gap-2 h-14 pt-1">
        {[
          { h1: "h-3", h2: "h-4", h3: "h-5" },
          { h1: "h-4", h2: "h-5", h3: "h-7" },
          { h1: "h-2", h2: "h-3", h3: "h-4" },
          { h1: "h-5", h2: "h-6", h3: "h-8" },
        ].map((col, i) => (
          <div key={i} className="flex flex-col gap-0.5 w-6">
            <div className={`w-full rounded-xs bg-indigo-600 ${col.h3}`} />
            <div className={`w-full rounded-xs bg-cyan-500 ${col.h2}`} />
            <div className={`w-full rounded-xs bg-teal-400 ${col.h1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsWeeklyBarPreview() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex justify-between items-center text-[9px]">
        <span className="font-bold text-text-strong">24,473 hrs</span>
        <span className="text-[8px] text-emerald-600 font-bold">+8.3%</span>
      </div>
      <div className="flex items-end justify-between gap-1.5 h-14 pt-2">
        {[20, 45, 90, 35, 55, 30, 65].map((val, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1 flex-1">
            {idx === 2 && (
              <span className="text-[6px] font-bold bg-primary text-white px-1 rounded-full">3.8k</span>
            )}
            <div
              className={cn(
                "w-full rounded-t-sm",
                idx === 2 ? "bg-primary" : "bg-border-default",
              )}
              style={{ height: `${val}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsDistributionDonutPreview() {
  return (
    <div className="p-3 space-y-2 text-center">
      <div className="relative mx-auto size-16 flex items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-border-subtle"
            strokeWidth="4"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-primary"
            strokeDasharray="45, 100"
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="text-sky-500"
            strokeDasharray="30, 100"
            strokeDashoffset="-45"
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span className="absolute text-[8px] font-extrabold text-text-strong">830</span>
      </div>
      <div className="flex justify-center gap-2 text-[8px] text-text-muted font-medium">
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary" />Events</span>
        <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-sky-500" />Committees</span>
      </div>
    </div>
  );
}

function AnalyticsGrowthAreaPreview() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex justify-between items-center text-[9px]">
        <span className="font-bold text-text-strong">Participation Growth</span>
        <span className="text-emerald-600 font-bold text-[8px]">+24.5%</span>
      </div>
      <div className="h-12 w-full pt-1">
        <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,35 Q20,25 40,28 T80,10 T100,5 L100,40 L0,40 Z" fill="url(#prevGrad)" />
          <path d="M0,35 Q20,25 40,28 T80,10 T100,5" fill="none" stroke="#4f46e5" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

function AnalyticsEventTablePreview() {
  return (
    <div className="p-3 space-y-1.5">
      {[
        { name: "IEEE Technoverse", rate: "92%" },
        { name: "Annual Hackathon", rate: "85%" },
      ].map((e) => (
        <div key={e.name} className="flex items-center justify-between rounded bg-bg-base p-1.5 text-[8px]">
          <span className="font-semibold text-text-strong truncate">{e.name}</span>
          <span className="font-bold text-primary">{e.rate}</span>
        </div>
      ))}
    </div>
  );
}

function MyProjectsPreview() {
  return (
    <div className="p-2.5 space-y-1.5">
      <div className="flex justify-between items-center text-[8px] font-bold text-text-muted px-1">
        <span>Task Name</span>
        <span>Status</span>
      </div>
      {[
        { name: "TANGO 2025 - Member Onboarding", tag: "In Progress", statusClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
        { name: "IEEE Day 2025 Summit", tag: "Pending", statusClass: "bg-amber-50 text-amber-800 border-amber-200" },
      ].map((item) => (
        <div key={item.name} className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-base p-1.5 text-[8px]">
          <span className="font-bold text-text-strong truncate max-w-[110px]">{item.name}</span>
          <span className={cn("px-1.5 py-0.5 rounded-full font-bold border text-[7px]", item.statusClass)}>
            {item.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

function SchedulePreview() {
  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-7 gap-0.5 rounded-md bg-bg-base p-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-6 rounded text-[8px] flex items-center justify-center",
              i === 2 ? "bg-primary-soft text-primary font-bold" : "text-text-muted",
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="h-8 rounded-md border border-border-subtle bg-bg-base flex gap-1 p-1.5">
        <div className="w-0.5 rounded-full bg-success" />
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-3/4 rounded bg-text-strong/15" />
          <div className="h-1 w-1/2 rounded bg-text-strong/8" />
        </div>
      </div>
    </div>
  );
}

function ProfileOverviewPreview() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-2 border-b border-dashed border-border-subtle pb-2 last:border-0">
          <div className="size-4 rounded-full bg-primary-soft shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-2/3 rounded bg-text-strong/15" />
            <div className="h-1 w-full rounded bg-text-strong/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderboardMiniPreview() {
  const podium = [
    { h: "h-10", tone: "bg-silver/30 border-silver/50", rank: 2 },
    { h: "h-14", tone: "bg-gold/25 border-gold/50", rank: 1 },
    { h: "h-8", tone: "bg-bronze/25 border-bronze/50", rank: 3 },
  ];
  return (
    <div className="p-3">
      <div className="flex items-end justify-center gap-1.5 mb-2 h-16">
        {podium.map((p) => (
          <div
            key={p.rank}
            className={cn(
              "w-8 rounded-t-md border flex flex-col items-center justify-end pb-1",
              p.h,
              p.tone,
            )}
          >
            <span className="text-[9px] font-bold text-text-strong">#{p.rank}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {PREVIEW_SAMPLE.names.slice(0, 2).map((name, i) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md bg-bg-base px-2 py-1 text-[9px]"
          >
            <span className="font-medium text-text-strong truncate">{name}</span>
            <span className="text-text-muted">{PREVIEW_SAMPLE.points[i]} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardBarChartPreview() {
  const max = Math.max(...PREVIEW_SAMPLE.points);
  return (
    <div className="p-3 space-y-2">
      {PREVIEW_SAMPLE.names.map((name, i) => {
        const pct = (PREVIEW_SAMPLE.points[i] / max) * 100;
        return (
          <div key={name}>
            <div className="flex justify-between text-[8px] mb-0.5">
              <span className="text-text-body truncate">{name}</span>
              <span className="text-text-muted tabular-nums">{PREVIEW_SAMPLE.points[i]}</span>
            </div>
            <div className="h-2 rounded-full bg-bg-base overflow-hidden border border-border-subtle">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickLinksPreview() {
  return (
    <div className="p-3 space-y-1.5">
      {["Events", "Leaderboard", "Profile"].map((label) => (
        <div
          key={label}
          className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[9px] font-medium text-text-body"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function WelcomeGreetingPreview() {
  return (
    <div className="p-3 space-y-1.5">
      <span className="text-[8px] font-medium text-text-muted">Thursday, 6th August</span>
      <div className="flex items-end justify-between gap-2">
        <h3 className="text-[14px] font-extrabold text-text-strong">Good Evening! Vishwa</h3>
        <div className="flex flex-col items-end gap-0.5 border-l border-border-subtle pl-2 shrink-0">
          <span className="text-[5px] font-semibold uppercase tracking-widest text-text-muted">IEEE SB · UoM</span>
          <span className="text-[7px] font-medium text-text-body">Volunteer portal</span>
        </div>
      </div>
    </div>
  );
}

function NotificationsPreview() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="rounded-md border border-primary-mid bg-primary-soft px-2 py-1.5">
        <div className="h-1.5 w-2/3 rounded bg-primary/30 mb-1" />
        <div className="h-1 w-full rounded bg-primary/15" />
      </div>
      <div className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5">
        <div className="h-1.5 w-1/2 rounded bg-text-strong/12 mb-1" />
        <div className="h-1 w-4/5 rounded bg-text-strong/8" />
      </div>
    </div>
  );
}

const PREVIEW_BY_TYPE: Record<DashboardWidgetType, () => React.ReactNode> = {
  welcome_greeting: WelcomeGreetingPreview,
  stat_capsule: StatCapsulePreview,
  kpi_metrics_row: KPIMetricsPreview,
  analytics_stacked_flow: AnalyticsStackedFlowPreview,
  analytics_weekly_bar: AnalyticsWeeklyBarPreview,
  analytics_distribution_donut: AnalyticsDistributionDonutPreview,
  analytics_growth_area: AnalyticsGrowthAreaPreview,
  analytics_event_table: AnalyticsEventTablePreview,
  my_projects: MyProjectsPreview,
  schedule: SchedulePreview,
  profile_overview: ProfileOverviewPreview,
  leaderboard_mini: LeaderboardMiniPreview,
  leaderboard_bar_chart: LeaderboardBarChartPreview,
  quick_links: QuickLinksPreview,
  notifications_summary: NotificationsPreview,
};

export function WidgetCatalogPreview({ widgetType }: { widgetType: DashboardWidgetType }) {
  const Preview = PREVIEW_BY_TYPE[widgetType] || StatCapsulePreview;
  return (
    <PreviewFrame className="h-[128px] bg-bg-base/40">
      <Preview />
    </PreviewFrame>
  );
}
