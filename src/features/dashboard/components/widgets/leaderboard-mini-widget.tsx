"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";
import {
  RankBadge,
  SelfPill,
  rankRowClasses,
} from "@/components/leaderboard/leaderboard-table-ui";
import { cn } from "@/lib/utils";

export type LeaderboardPreviewEntry = {
  userId: string;
  name: string;
  points: number;
};

export function LeaderboardMiniWidget({
  entries,
}: {
  entries: LeaderboardPreviewEntry[];
}) {
  const { user } = useDashboardData();
  const currentUserId = user.authUser.id;
  const leader = entries[0];
  const rest = entries.slice(1);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Trophy className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-text-strong">Top volunteers</h2>
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

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-base/60 px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-text-strong">No standings yet</p>
          <p className="mt-1 text-[12px] text-text-muted">
            Points will appear here once scoring is underway.
          </p>
          <Link
            href="/scoring"
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            Open leaderboard <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {leader ? (
            <Link
              href={`/volunteers/${leader.userId}`}
              aria-label={`${leader.name}, rank 1, ${leader.points} points`}
              className={cn(
                "flex items-center gap-4 rounded-xl border border-border-subtle border-l-2 border-l-gold/50 px-4 py-3.5 transition-colors hover:border-primary-mid hover:bg-primary-soft/30",
                rankRowClasses(1),
              )}
            >
              <RankBadge rank={1} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-text-strong">
                    {leader.name}
                  </span>
                  {leader.userId === currentUserId ? <SelfPill /> : null}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-text-muted">Leading this term</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[20px] font-bold tabular-nums leading-none text-text-strong">
                  {leader.points}
                </p>
                <p className="mt-1 text-[11px] font-medium text-text-muted">pts</p>
              </div>
            </Link>
          ) : null}

          {rest.length > 0 ? (
            <ol className="overflow-hidden rounded-lg border border-border-subtle bg-bg-base/40">
              {rest.map((entry, index) => {
                const rank = index + 2;
                const isSelf = entry.userId === currentUserId;
                return (
                  <li
                    key={entry.userId}
                    className={cn(
                      "border-b border-border-subtle last:border-b-0",
                      isSelf && "bg-primary-soft/50",
                    )}
                  >
                    <Link
                      href={`/volunteers/${entry.userId}`}
                      aria-label={`${entry.name}, rank ${rank}, ${entry.points} points`}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-primary-soft/40"
                    >
                      {rank <= 3 ? (
                        <RankBadge rank={rank} />
                      ) : (
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-[12px] font-bold tabular-nums text-text-muted">
                          #{rank}
                        </span>
                      )}
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-text-strong">
                          {entry.name}
                        </span>
                        {isSelf ? <SelfPill /> : null}
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-text-body">
                        {entry.points}
                        <span className="ml-0.5 font-normal text-text-muted">pts</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      )}
    </div>
  );
}
