"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaderboardEntry = {
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

function mapLeaderboardRows(rows: LeaderboardRow[]): LeaderboardEntry[] {
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
    };
  }
  if (rank === 2) {
    return {
      badge: "bg-neutral-soft text-text-body border-silver/50",
      ring: "ring-silver/40",
    };
  }
  if (rank === 3) {
    return {
      badge: "bg-bronze/15 text-[hsl(20,65%,32%)] border-bronze/40",
      ring: "ring-bronze/35",
    };
  }
  return {
    badge: "bg-primary-soft text-primary border-primary-mid",
    ring: "ring-border-subtle",
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
    <div className="mb-4 flex items-end justify-center gap-2 px-1">
      {order.map(({ entry, height, label }) => {
        const tone = rankTone(entry.rank);
        return (
          <div
            key={entry.userId}
            className="flex max-w-[88px] flex-1 flex-col items-center gap-1.5"
          >
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
                "flex w-full flex-col items-center justify-end rounded-t-xl border border-b-0 bg-gradient-to-t from-bg-base to-surface-raised pb-2 pt-1",
                height,
                tone.badge,
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                #{label}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-text-strong">
                {entry.totalPoints}
              </span>
            </div>
            <p className="w-full truncate text-center text-[10px] font-medium text-text-body">
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

  const showPodium = entries.length >= 2;
  const listEntries = useMemo(() => {
    if (showPodium) {
      return entries.filter((entry) => entry.rank > 3);
    }
    return entries;
  }, [entries, showPodium]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-gradient-to-br from-primary-soft/80 via-surface-raised to-surface-raised px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary-mid bg-surface-raised">
            <Trophy className="size-4 text-gold" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight text-text-strong">
              Top volunteers
            </h2>
            <p className="mt-0.5 text-[11px] text-text-muted">Current term standings</p>
          </div>
        </div>
        <Link
          href="/scoring"
          className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="py-2 text-[13px] text-text-muted">{error}</p>
        ) : entries.length === 0 ? (
          <p className="py-2 text-[13px] text-text-muted">No leaderboard data yet.</p>
        ) : (
          <>
            {showPodium ? <Podium entries={entries} /> : null}
            {listEntries.length > 0 ? (
              <ol className="space-y-2">
                {listEntries.map((entry) => {
                  const tone = rankTone(entry.rank);
                  return (
                    <li
                      key={entry.userId}
                      className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-base/80 px-3 py-2.5 transition-colors hover:border-primary-mid hover:bg-primary-soft/40"
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-8 justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                          tone.badge,
                        )}
                      >
                        #{entry.rank}
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                        {initials(entry.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-strong">
                        {entry.name}
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text-body">
                        {entry.totalPoints}
                        <span className="ml-0.5 font-normal text-text-muted">pts</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
