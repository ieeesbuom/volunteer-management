"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, ArrowUpRight } from "lucide-react";

type GrowthPoint = {
  month: string;
  volunteers: number;
  hours: number;
};

const GROWTH_DATA: GrowthPoint[] = [
  { month: "Jan", volunteers: 420, hours: 2100 },
  { month: "Feb", volunteers: 580, hours: 2900 },
  { month: "Mar", volunteers: 650, hours: 3400 },
  { month: "Apr", volunteers: 820, hours: 4200 },
  { month: "May", volunteers: 950, hours: 5100 },
  { month: "Jun", volunteers: 1120, hours: 6300 },
  { month: "Jul", volunteers: 1248, hours: 7400 },
];

export function AnalyticsGrowthAreaWidget() {
  const [metric, setVolunteers] = useState<"volunteers" | "hours">("hours");

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary-mid">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-text-strong">Participation Growth</h2>
            <p className="text-[11px] text-text-muted">6-month continuous trend</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
            +24.5% <ArrowUpRight className="size-3.5 stroke-[2.5]" />
          </span>
          <div className="flex rounded-xl bg-bg-base p-1 border border-border-subtle text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setVolunteers("hours")}
              className={`rounded-lg px-2.5 py-0.5 transition-colors cursor-pointer ${
                metric === "hours" ? "bg-surface-raised text-primary font-bold" : "text-text-muted"
              }`}
            >
              Hours
            </button>
            <button
              type="button"
              onClick={() => setVolunteers("volunteers")}
              className={`rounded-lg px-2.5 py-0.5 transition-colors cursor-pointer ${
                metric === "volunteers" ? "bg-surface-raised text-primary font-bold" : "text-text-muted"
              }`}
            >
              Volunteers
            </button>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="flex-1 min-h-[170px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={GROWTH_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(216, 79%, 36%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(216, 79%, 36%)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220, 13%, 91%)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 52%)" }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(220, 10%, 52%)" }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="rounded-xl border border-border-subtle bg-surface-overlay/95 backdrop-blur-md p-3 shadow-lg text-[12px]">
                    <p className="font-bold text-text-strong mb-1">{label}</p>
                    <p className="text-primary font-semibold">
                      {metric === "hours" ? `${payload[0].value} hours` : `${payload[0].value} active volunteers`}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="hsl(216, 79%, 36%)"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#areaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
