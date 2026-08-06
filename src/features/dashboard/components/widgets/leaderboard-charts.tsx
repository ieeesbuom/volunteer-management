"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Trophy, Loader2, TrendingUp, BarChart2, ListOrdered, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  totalPoints: number;
  rank: number;
};

type LeaderboardRow = {
  userId: string;
  name: string;
  points: number;
};

export function mapLeaderboardRows(rows: LeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    userId: row.userId,
    name: row.name,
    totalPoints: row.points,
    rank: index + 1,
  }));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function rankTone(rank: number) {
  if (rank === 1) {
    return {
      badge: "bg-gold/15 text-[hsl(43,90%,32%)] border-gold/40",
      ring: "ring-gold/35",
      bar: "from-gold/90 to-gold",
      hex: "#f59e0b",
    };
  }
  if (rank === 2) {
    return {
      badge: "bg-neutral-soft text-text-body border-silver/50",
      ring: "ring-silver/40",
      bar: "from-silver to-neutral-soft",
      hex: "#64748b",
    };
  }
  if (rank === 3) {
    return {
      badge: "bg-bronze/15 text-[hsl(20,65%,32%)] border-bronze/40",
      ring: "ring-bronze/35",
      bar: "from-bronze to-bronze/70",
      hex: "#d97706",
    };
  }
  return {
    badge: "bg-primary-soft text-primary border-primary-mid",
    ring: "ring-border-subtle",
    bar: "from-primary to-primary-hover",
    hex: "#4f46e5",
  };
}

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length < 2) {
    return null;
  }

  const order = [
    { entry: entries[1], height: "h-[52px]", label: "2" },
    { entry: entries[0], height: "h-[68px]", label: "1" },
    { entry: entries[2], height: "h-[44px]", label: "3" },
  ].filter((slot) => slot.entry);

  return (
    <div className="flex items-end justify-center gap-2 mb-4 px-1">
      {order.map(({ entry, height, label }) => {
        const tone = rankTone(entry.rank);
        return (
          <div key={entry.userId} className="flex flex-col items-center gap-1.5 flex-1 max-w-[88px]">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2",
                tone.ring,
                entry.rank === 1 ? "bg-gold" : entry.rank === 2 ? "bg-silver" : "bg-bronze",
              )}
            >
              {initials(entry.name)}
            </div>
            <div
              className={cn(
                "w-full rounded-t-xl border border-b-0 flex flex-col items-center justify-end pb-2 pt-1 bg-gradient-to-t from-bg-base to-surface-raised",
                height,
                tone.badge,
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">#{label}</span>
              <span className="text-[11px] font-semibold text-text-strong tabular-nums">
                {entry.totalPoints}
              </span>
            </div>
            <p className="text-[10px] font-medium text-text-body truncate w-full text-center">
              {entry.name.split(" ")[0]}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function LeaderboardMiniWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/scoring/leaderboard");
        if (!res.ok) {
          throw new Error("Failed to load leaderboard");
        }
        const data = (await res.json()) as { leaderboard?: LeaderboardRow[] };
        if (!cancelled) {
          setEntries(mapLeaderboardRows(data.leaderboard ?? []).slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setError("Could not load standings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rest = useMemo(() => entries.filter((e) => e.rank > 3), [entries]);

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised flex flex-col overflow-hidden">
      <div className="relative shrink-0 px-5 pt-5 pb-3 border-b border-border-subtle bg-gradient-to-br from-primary-soft/80 via-surface-raised to-surface-raised">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-surface-raised border border-primary-mid">
                <Trophy className="size-4 text-gold" aria-hidden />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-text-strong leading-tight">
                  Top volunteers
                </h2>
                <p className="text-[11px] text-text-muted mt-0.5">Current term standings</p>
              </div>
            </div>
          </div>
          <Link
            href="/scoring"
            className="text-[12px] font-semibold text-primary hover:underline cursor-pointer shrink-0 pt-1"
          >
            View all
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-[13px] text-text-muted py-4">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] text-text-muted py-4">No leaderboard data yet.</p>
        ) : (
          <>
            {entries.length >= 2 && <Podium entries={entries} />}
            <ol className="space-y-2">
              {(rest.length > 0 ? rest : entries.slice(3)).map((entry) => {
                const tone = rankTone(entry.rank);
                return (
                  <li
                    key={entry.userId}
                    className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-base/80 px-3 py-2.5 transition-colors hover:bg-primary-soft/40 hover:border-primary-mid"
                  >
                    <span
                      className={cn(
                        "inline-flex min-w-[2rem] justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                        tone.badge,
                      )}
                    >
                      #{entry.rank}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white bg-primary",
                      )}
                    >
                      {initials(entry.name)}
                    </span>
                    <span className="flex-1 min-w-0 font-medium text-[13px] text-text-strong truncate">
                      {entry.name}
                    </span>
                    <span className="text-[12px] font-semibold text-text-body tabular-nums shrink-0">
                      {entry.totalPoints}
                      <span className="text-text-muted font-normal ml-0.5">pts</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

type RechartsTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: LeaderboardEntry;
  }>;
};

function RechartsPointsTooltip({ active, payload }: RechartsTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const tone = rankTone(data.rank);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/95 backdrop-blur-md p-3 shadow-lg text-[12px]">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={cn(
            "text-[10px] font-bold rounded px-1.5 py-0.5 border tabular-nums",
            tone.badge,
          )}
        >
          #{data.rank}
        </span>
        <span className="font-bold text-text-strong">{data.name}</span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-border-subtle text-text-muted">
        <span>Accumulated Score:</span>
        <span className="font-extrabold text-primary tabular-nums">{data.totalPoints} pts</span>
      </div>
    </div>
  );
}

export function LeaderboardBarChartWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"chart" | "tracks">("chart");
  const [term, setTerm] = useState<"This Term" | "All Time">("This Term");
  const [termDropdownOpen, setTermDropdownOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/scoring/leaderboard");
        if (!res.ok) {
          throw new Error("Failed to load leaderboard");
        }
        const data = (await res.json()) as { leaderboard?: LeaderboardRow[] };
        if (!cancelled) {
          let rows = mapLeaderboardRows(data.leaderboard ?? []);
          if (term === "This Term") {
            rows = rows.slice(0, 7);
          } else {
            rows = rows.slice(0, 10);
          }
          setEntries(rows);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load chart data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [term]);

  const maxPoints = useMemo(
    () => Math.max(1, ...entries.map((e) => e.totalPoints)),
    [entries],
  );

  const totalPointsPool = useMemo(
    () => entries.reduce((sum, e) => sum + e.totalPoints, 0),
    [entries],
  );

  const avgPoints = useMemo(
    () => (entries.length > 0 ? Math.round(totalPointsPool / entries.length) : 0),
    [entries, totalPointsPool],
  );

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary border border-primary-mid">
              <TrendingUp className="size-4" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-text-strong">Points System & Standings</h2>
              <p className="text-[11px] text-text-muted mt-0.5">Volunteer performance distribution</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Term Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTermDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-base px-2.5 py-1 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
              >
                {term}
                <ChevronDown className={`size-3.5 text-text-muted transition-transform duration-200 ${termDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {termDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-32 rounded-xl border border-border-subtle bg-surface-raised p-1 shadow-lg text-[12px]">
                  {(["This Term", "All Time"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setTerm(option);
                        setTermDropdownOpen(false);
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

            {/* View Mode Toggle */}
            <div className="flex rounded-xl bg-bg-base p-1 border border-border-subtle text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setViewMode("chart")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors cursor-pointer",
                  viewMode === "chart"
                    ? "bg-surface-raised text-primary font-bold"
                    : "text-text-muted hover:text-text-strong",
                )}
                title="Interactive Recharts Bar View"
              >
                <BarChart2 className="size-3.5" />
                Chart
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tracks")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition-colors cursor-pointer",
                  viewMode === "tracks"
                    ? "bg-surface-raised text-primary font-bold"
                    : "text-text-muted hover:text-text-strong",
                )}
                title="Progress Track View"
              >
                <ListOrdered className="size-3.5" />
                Tracks
              </button>
            </div>

            <Link
              href="/scoring"
              className="text-[12px] font-semibold text-primary hover:underline cursor-pointer shrink-0 pl-1"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Summary Metric Pills */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border-subtle bg-bg-base/70 p-2 text-[12px]">
          <div className="flex flex-col px-2 py-0.5">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Total Points
            </span>
            <span className="font-extrabold text-text-strong tabular-nums mt-0.5">
              {totalPointsPool.toLocaleString()} pts
            </span>
          </div>
          <div className="flex flex-col px-2 py-0.5 border-x border-border-subtle">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Top Score
            </span>
            <span className="font-extrabold text-primary tabular-nums mt-0.5">
              {maxPoints.toLocaleString()} pts
            </span>
          </div>
          <div className="flex flex-col px-2 py-0.5">
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              Avg Score
            </span>
            <span className="font-extrabold text-text-strong tabular-nums mt-0.5">
              {avgPoints.toLocaleString()} pts
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-[13px] text-text-muted py-4">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] text-text-muted py-4">No data to chart yet.</p>
        ) : viewMode === "chart" ? (
          /* Recharts Horizontal Bar Chart View */
          <div className="h-full min-h-[220px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={entries}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(220, 13%, 91%)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(220, 10%, 52%)" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tick={({ x, y, payload }) => {
                    const entry = entries.find((e) => e.name === payload.value);
                    const tone = rankTone(entry?.rank ?? 99);
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={-8}
                          y={4}
                          textAnchor="end"
                          fontSize={12}
                          fontWeight={600}
                          fill={tone.hex}
                        >
                          {payload.value.length > 13
                            ? `${payload.value.slice(0, 12)}…`
                            : payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <Tooltip content={<RechartsPointsTooltip />} cursor={{ fill: "hsl(216, 80%, 97%)" }} />
                <Bar dataKey="totalPoints" radius={[0, 8, 8, 0]} barSize={20}>
                  {entries.map((entry) => (
                    <Cell key={entry.userId} fill={rankTone(entry.rank).hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Progress Tracks View */
          <div className="space-y-3 pt-1">
            {entries.map((entry) => {
              const pct = Math.max(5, Math.round((entry.totalPoints / maxPoints) * 100));
              const tone = rankTone(entry.rank);

              return (
                <div key={entry.userId} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "text-[10px] font-bold rounded px-1.5 py-0.5 border tabular-nums shrink-0",
                          tone.badge,
                        )}
                      >
                        #{entry.rank}
                      </span>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white bg-primary",
                        )}
                      >
                        {initials(entry.name)}
                      </span>
                      <span className="font-semibold text-text-strong truncate">
                        {entry.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-primary bg-primary-soft border border-primary-mid px-2 py-0.5 rounded-full tabular-nums">
                        {pct}%
                      </span>
                      <span className="font-extrabold text-text-strong tabular-nums text-[13px] min-w-[50px] text-right">
                        {entry.totalPoints} pts
                      </span>
                    </div>
                  </div>

                  {/* Modern Sleek Progress Bar Track */}
                  <div className="relative h-2.5 w-full rounded-full bg-bg-base border border-border-subtle overflow-hidden shadow-inner">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 origin-left rounded-full bg-gradient-to-r dashboard-bar-fill transition-all duration-500",
                        tone.bar,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
