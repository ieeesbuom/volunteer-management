"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, Check } from "lucide-react";

type CategoryItem = {
  name: string;
  value: number;
  color: string;
};

const DATASETS: Record<string, CategoryItem[]> = {
  Monthly: [
    { name: "Events", value: 374.82, color: "#4f46e5" },
    { name: "Committees", value: 241.6, color: "#0ea5e9" },
    { name: "Other", value: 213.42, color: "#cbd5e1" },
  ],
  Quarterly: [
    { name: "Events", value: 1120.5, color: "#4f46e5" },
    { name: "Committees", value: 850.2, color: "#0ea5e9" },
    { name: "Other", value: 580.3, color: "#cbd5e1" },
  ],
  Yearly: [
    { name: "Events", value: 4850.0, color: "#4f46e5" },
    { name: "Committees", value: 3420.0, color: "#0ea5e9" },
    { name: "Other", value: 2190.0, color: "#cbd5e1" },
  ],
};

export function AnalyticsDistributionDonutWidget() {
  const [period, setPeriod] = useState<"Monthly" | "Quarterly" | "Yearly">("Monthly");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dataset = DATASETS[period] || DATASETS.Monthly;

  const total = useMemo(
    () => dataset.reduce((acc, item) => acc + item.value, 0),
    [dataset],
  );

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 shrink-0">
        <span className="text-[14px] font-bold text-text-strong">Category Distribution</span>

        {/* Period Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-base px-3 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
          >
            {period}
            <ChevronDown className={`size-3.5 text-text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-36 rounded-xl border border-border-subtle bg-surface-raised p-1.5 shadow-lg text-[12px]">
              {(["Monthly", "Quarterly", "Yearly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setPeriod(option);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                    period === option
                      ? "bg-primary-soft text-primary font-bold"
                      : "text-text-body hover:bg-bg-base"
                  }`}
                >
                  <span>{option}</span>
                  {period === option && <Check className="size-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Values Breakdown Row */}
      <div className="grid grid-cols-3 gap-2 py-2 border-b border-border-subtle text-[12px] shrink-0">
        {dataset.map((item) => (
          <div key={item.name} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[11px] font-medium text-text-muted truncate">{item.name}</span>
            </div>
            <p className="text-[14px] font-bold text-text-strong tabular-nums">
              {item.value.toFixed(1)} pts
            </p>
          </div>
        ))}
      </div>

      {/* Recharts Semi-Circle Donut */}
      <div className="relative flex-1 min-h-[140px] w-full pt-2 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataset}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius="65%"
              outerRadius="95%"
              paddingAngle={4}
              dataKey="value"
              cornerRadius={6}
            >
              {dataset.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as CategoryItem;
                const pct = ((data.value / total) * 100).toFixed(1);
                return (
                  <div className="rounded-lg border border-border-subtle bg-surface-overlay p-2 shadow-md text-[11px]">
                    <p className="font-bold text-text-strong">{data.name}</p>
                    <p className="text-primary font-semibold">
                      {data.value.toLocaleString()} pts ({pct}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label inside half pie */}
        <div className="absolute bottom-2 text-center pointer-events-none">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Total</p>
          <p className="text-[18px] font-extrabold text-text-strong tabular-nums">
            {total.toFixed(0)} pts
          </p>
        </div>
      </div>
    </div>
  );
}
