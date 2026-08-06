"use client";

import { Search } from "lucide-react";
import {
  LeaderboardTableHead,
  LeaderboardTableShell,
  PointsPill,
  volunteerInitials,
} from "@/components/leaderboard/leaderboard-table-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GradeAuditEntry } from "../types";

export type ExtraScoreAuditRow = {
  $id: string;
  eventTitle?: string | null;
  eventId: string;
  volunteerName: string;
  reviewerName: string;
  gradeValue: number;
  submittedAt: string;
  audit_metadata?: string | null;
};

function parseAuditCorrections(metadata: string | null | undefined): GradeAuditEntry[] {
  if (!metadata) {
    return [];
  }
  try {
    const parsed = JSON.parse(metadata);
    if (Array.isArray(parsed)) {
      return parsed as GradeAuditEntry[];
    }
  } catch {
    /* ignore malformed audit payloads */
  }
  return [];
}

function formatSubmittedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function AuditCorrectionsCell({ metadata }: { metadata?: string | null }) {
  const entries = parseAuditCorrections(metadata);

  if (entries.length === 0) {
    return <span className="text-[13px] text-text-muted">None</span>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => (
        <div
          key={`${entry.changedAt}-${idx}`}
          className="rounded-lg border border-border-subtle bg-bg-base/60 px-3 py-2 text-[12px] leading-snug"
        >
          <p className="font-semibold text-text-strong">
            {entry.originalValue}
            <span className="mx-1.5 font-normal text-text-muted">→</span>
            {entry.newValue}
          </p>
          <p className="mt-0.5 text-text-muted">
            {entry.changedBy}
            <span className="mx-1">·</span>
            {formatSubmittedAt(entry.changedAt)}
            {entry.reason ? (
              <>
                <span className="mx-1">·</span>
                {entry.reason}
              </>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ExtraScoreAuditTable({
  eventLabel,
  loading,
  onPageChange,
  page,
  pageCount,
  pageSize,
  rows,
  search,
  onSearchChange,
  totalCount,
}: Readonly<{
  eventLabel: (eventId: string) => string;
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  rows: ExtraScoreAuditRow[];
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
}>) {
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted">
          {loading ? "Loading records…" : `${totalCount} ${totalCount === 1 ? "entry" : "entries"}`}
        </p>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-placeholder" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search event or volunteer"
            className="h-[38px] w-full rounded-full border border-border-subtle bg-surface-raised pl-10 pr-4 text-[13px] text-text-body placeholder:text-text-placeholder focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/0.12)] focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-raised py-12 text-center text-[13px] text-text-muted">
          Loading audit log…
        </div>
      ) : rows.length > 0 ? (
        <>
          <LeaderboardTableShell minWidth={880}>
            <colgroup>
              <col className="min-w-[140px]" />
              <col className="min-w-[140px]" />
              <col className="min-w-[120px]" />
              <col className="w-[88px]" />
              <col className="min-w-[140px]" />
              <col className="min-w-[200px]" />
            </colgroup>
            <LeaderboardTableHead
              columns={[
                { label: "Event" },
                { label: "Volunteer" },
                { label: "Submitted by" },
                { label: "Score", align: "right" },
                { label: "Submitted" },
                { label: "Corrections" },
              ]}
            />
            <tbody>
              {rows.map((rev) => (
                <tr
                  key={rev.$id}
                  className="border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-base/70"
                >
                  <td className="px-4 py-3.5 align-top">
                    <p className="max-w-[220px] text-[13px] font-semibold leading-snug text-text-strong">
                      {rev.eventTitle ?? eventLabel(rev.eventId)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary-soft text-[11px] font-bold text-primary"
                      >
                        {volunteerInitials(rev.volunteerName)}
                      </span>
                      <span className="text-[13px] font-medium text-text-body">{rev.volunteerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top text-[13px] text-text-muted">{rev.reviewerName}</td>
                  <td className="px-4 py-3.5 align-top text-right">
                    <PointsPill value={rev.gradeValue} className="min-w-[3.25rem]" />
                  </td>
                  <td className="px-4 py-3.5 align-top text-[13px] tabular-nums text-text-muted">
                    {formatSubmittedAt(rev.submittedAt)}
                  </td>
                  <td className="max-w-[280px] px-4 py-3.5 align-top">
                    <AuditCorrectionsCell metadata={rev.audit_metadata} />
                  </td>
                </tr>
              ))}
            </tbody>
          </LeaderboardTableShell>

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-text-muted">
              Showing {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            {totalCount > pageSize ? (
              <div className="flex gap-2">
                <Button
                  disabled={page === 0}
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                  type="button"
                  variant="secondary"
                  className="cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  disabled={page >= pageCount - 1}
                  onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                  type="button"
                  variant="secondary"
                  className="cursor-pointer"
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-border-subtle bg-bg-base/40 py-12 text-center text-[13px] text-text-muted",
          )}
        >
          {search
            ? "No extra score audit records match that search."
            : "No extra score submissions have been recorded yet."}
        </div>
      )}
    </div>
  );
}
