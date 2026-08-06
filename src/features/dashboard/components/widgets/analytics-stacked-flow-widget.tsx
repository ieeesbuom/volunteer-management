"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Filter, ArrowUpRight, ChevronDown, Check } from "lucide-react";

type DataPoint = {
  month: string;
  Events: number;
  Committees: number;
  Training: number;
  Outreach: number;
  Other: number;
};

const DATA_BY_TERM: Record<string, DataPoint[]> = {
  "This Term": [
    { month: "Sep", Events: 2400, Committees: 1800, Training: 1200, Outreach: 900, Other: 400 },
    { month: "Oct", Events: 2988, Committees: 2100, Training: 1400, Outreach: 1100, Other: 500 },
    { month: "Nov", Events: 1765, Committees: 1400, Training: 950, Outreach: 800, Other: 350 },
    { month: "Dec", Events: 4005, Committees: 2800, Training: 1900, Outreach: 1500, Other: 700 },
    { month: "Jan", Events: 3450, Committees: 2400, Training: 1600, Outreach: 1200, Other: 600 },
  ],
  "Last Term": [
    { month: "Apr", Events: 1800, Committees: 1400, Training: 1000, Outreach: 700, Other: 300 },
    { month: "May", Events: 2200, Committees: 1700, Training: 1100, Outreach: 850, Other: 400 },
    { month: "Jun", Events: 3100, Committees: 2300, Training: 1500, Outreach: 1200, Other: 500 },
    { month: "Jul", Events: 2800, Committees: 1900, Training: 1300, Outreach: 1000, Other: 450 },
    { month: "Aug", Events: 3500, Committees: 2600, Training: 1700, Outreach: 1400, Other: 600 },
  ],
  "Full Year": [
    { month: "Q1", Events: 7100, Committees: 5400, Training: 3600, Outreach: 2750, Other: 1200 },
    { month: "Q2", Events: 9400, Committees: 6800, Training: 4500, Outreach: 3600, Other: 1550 },
    { month: "Q3", Events: 11200, Committees: 8100, Training: 5700, Outreach: 4300, Other: 1900 },
    { month: "Q4", Events: 12600, Committees: 9200, Training: 6400, Outreach: 4900, Other: 2200 },
  ],
};

const CATEGORY_COLORS: Record<string, string> = {
  Events: "#4f46e5",
  Committees: "#6366f1",
  Training: "#0ea5e9",
  Outreach: "#38bdf8",
  Other: "#14b8a6",
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/95 backdrop-blur-md p-3 shadow-lg text-[12px]">
      <p className="font-bold text-text-strong mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-muted font-medium">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-text-strong tabular-nums">{entry.value} pts</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-border-subtle pt-1.5 flex justify-between font-bold text-text-strong">
        <span>Total Points</span>
        <span className="text-primary tabular-nums">{total} pts</span>
      </div>
    </div>
  );
}

export function AnalyticsStackedFlowWidget() {
  const [term, setTerm] = useState<string>("This Term");
  const [termMenuOpen, setTermMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({
    Events: true,
    Committees: true,
    Training: true,
    Outreach: true,
    Other: true,
  });

  const dataset = DATA_BY_TERM[term] || DATA_BY_TERM["This Term"];

  const latestTotal = useMemo(() => {
    if (dataset.length === 0) return 0;
    const last = dataset[dataset.length - 1];
    let sum = 0;
    if (activeCategories.Events) sum += last.Events;
    if (activeCategories.Committees) sum += last.Committees;
    if (activeCategories.Training) sum += last.Training;
    if (activeCategories.Outreach) sum += last.Outreach;
    if (activeCategories.Other) sum += last.Other;
    return sum;
  }, [dataset, activeCategories]);

  function toggleCategory(cat: string) {
    setActiveCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  }

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border-subtle shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text-muted">Volunteer Impact Overview</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="text-[26px] sm:text-[30px] font-extrabold text-text-strong tracking-tight tabular-nums">
              {latestTotal.toLocaleString()} pts
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
              15.8% <ArrowUpRight className="size-3.5 stroke-[2.5]" />
            </span>
            <span className="text-[12px] font-normal text-text-muted">
              +1,240 pts increase
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFilterMenuOpen((prev) => !prev);
                setTermMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-base px-3 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
            >
              <Filter className="size-3.5 text-text-muted" />
              Filter
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-border-subtle bg-surface-raised p-2 shadow-lg text-[12px] space-y-1">
                <p className="text-[11px] font-bold text-text-muted px-2 py-1">Toggle Categories</p>
                {Object.keys(CATEGORY_COLORS).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer hover:bg-bg-base"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                      {cat}
                    </span>
                    {activeCategories[cat] && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Term Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setTermMenuOpen((prev) => !prev);
                setFilterMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-base px-3 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
            >
              {term}
              <ChevronDown className={`size-3.5 text-text-muted transition-transform duration-200 ${termMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {termMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-36 rounded-xl border border-border-subtle bg-surface-raised p-1.5 shadow-lg text-[12px]">
                {(["This Term", "Last Term", "Full Year"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setTerm(option);
                      setTermMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                      term === option
                        ? "bg-primary-soft text-primary font-bold"
                        : "text-text-body hover:bg-bg-base"
                    }`}
                  >
                    <span>{option}</span>
                    {term === option && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Stacked Chart */}
      <div className="flex-1 min-h-[180px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220, 13%, 91%)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(220, 10%, 52%)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "hsl(220, 10%, 52%)" }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(216, 80%, 97%)" }} />
            {activeCategories.Other && (
              <Bar dataKey="Other" stackId="a" fill={CATEGORY_COLORS.Other} barSize={42} />
            )}
            {activeCategories.Outreach && (
              <Bar dataKey="Outreach" stackId="a" fill={CATEGORY_COLORS.Outreach} />
            )}
            {activeCategories.Training && (
              <Bar dataKey="Training" stackId="a" fill={CATEGORY_COLORS.Training} />
            )}
            {activeCategories.Committees && (
              <Bar dataKey="Committees" stackId="a" fill={CATEGORY_COLORS.Committees} />
            )}
            {activeCategories.Events && (
              <Bar dataKey="Events" stackId="a" fill={CATEGORY_COLORS.Events} radius={[8, 8, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-border-subtle text-[11px] font-medium text-text-muted shrink-0">
        {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleCategory(key)}
            className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
              activeCategories[key] ? "opacity-100" : "opacity-40"
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{key}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
