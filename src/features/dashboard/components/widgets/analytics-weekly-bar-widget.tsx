"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ArrowUpRight, ChevronDown, Check } from "lucide-react";

type DayData = {
  day: string;
  hours: number;
  isPeak?: boolean;
};

const DATASETS: Record<string, { total: string; trend: string; delta: string; data: DayData[] }> = {
  Weekly: {
    total: "24,473 hrs",
    trend: "8.3%",
    delta: "+749 increased",
    data: [
      { day: "Sun", hours: 1240 },
      { day: "Mon", hours: 2150 },
      { day: "Tue", hours: 3874, isPeak: true },
      { day: "Wed", hours: 1890 },
      { day: "Thu", hours: 2450 },
      { day: "Fri", hours: 1680 },
      { day: "Sat", hours: 2950 },
    ],
  },
  Monthly: {
    total: "98,120 hrs",
    trend: "12.4%",
    delta: "+2,850 increased",
    data: [
      { day: "Wk 1", hours: 22100 },
      { day: "Wk 2", hours: 28400, isPeak: true },
      { day: "Wk 3", hours: 21500 },
      { day: "Wk 4", hours: 26120 },
    ],
  },
  Quarterly: {
    total: "284,500 hrs",
    trend: "15.1%",
    delta: "+8,200 increased",
    data: [
      { day: "Q1", hours: 64200 },
      { day: "Q2", hours: 78500 },
      { day: "Q3", hours: 91400, isPeak: true },
      { day: "Q4", hours: 50400 },
    ],
  },
};

export function AnalyticsWeeklyBarWidget() {
  const [timeframe, setTimeframe] = useState<"Weekly" | "Monthly" | "Quarterly">("Weekly");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeSet = DATASETS[timeframe] || DATASETS.Weekly;

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 shrink-0">
        <div>
          <span className="text-[13px] font-semibold text-text-muted">Total Volunteer Hours</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold text-text-strong tracking-tight tabular-nums">
              {activeSet.total}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
              {activeSet.trend} <ArrowUpRight className="size-3.5 stroke-[2.5]" />
            </span>
            <span className="text-[11px] font-medium text-text-muted">{activeSet.delta}</span>
          </div>
        </div>

        {/* Timeframe Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-base px-3 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
          >
            {timeframe}
            <ChevronDown className={`size-3.5 text-text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-36 rounded-xl border border-border-subtle bg-surface-raised p-1.5 shadow-lg text-[12px]">
              {(["Weekly", "Monthly", "Quarterly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setTimeframe(option);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                    timeframe === option
                      ? "bg-primary-soft text-primary font-bold"
                      : "text-text-body hover:bg-bg-base"
                  }`}
                >
                  <span>{option}</span>
                  {timeframe === option && <Check className="size-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="relative flex-1 min-h-[160px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeSet.data} margin={{ top: 15, right: 0, left: -25, bottom: 0 }}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 52%)", fontWeight: 500 }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(220, 10%, 52%)" }} />
            <Tooltip
              cursor={{ fill: "transparent" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as DayData;
                return (
                  <div className="rounded-lg border border-border-subtle bg-surface-overlay p-2 shadow-md text-[11px]">
                    <span className="font-bold text-text-strong">{data.day}: </span>
                    <span className="text-primary font-semibold">{data.hours.toLocaleString()} hrs</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="hours" radius={[8, 8, 8, 8]} barSize={28}>
              {activeSet.data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.isPeak ? "hsl(216, 79%, 36%)" : "hsl(220, 13%, 90%)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
