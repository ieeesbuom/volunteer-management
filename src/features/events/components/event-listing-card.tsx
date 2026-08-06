"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, MapPin } from "lucide-react";
import { badgeToneClassName } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventStatus,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Event } from "@/features/events/types";

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) {
    return "Today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  if (days < 30) {
    return `${days} days ago`;
  }
  const months = Math.floor(days / 30);
  if (months === 1) {
    return "1 month ago";
  }
  if (months < 12) {
    return `${months} months ago`;
  }
  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function getEventInitials(title: string) {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "EV";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border-default bg-surface-raised px-3 py-1 text-[12px] font-medium text-text-body">
      {children}
    </span>
  );
}

export type EventListingCardProps = {
  event: Event;
  href: string;
  subtitle?: string;
  primaryPills?: string[];
  tagLabels: string[];
  showConclusionInInfo?: boolean;
};

export function EventListingCard({
  event,
  href,
  subtitle,
  primaryPills,
  tagLabels,
  showConclusionInInfo = true,
}: EventListingCardProps) {
  const pills = primaryPills ?? [formatEventStatus(event.status).toUpperCase()];
  const visibleTags = tagLabels.slice(0, 4);
  const overflowCount = tagLabels.length - visibleTags.length;
  const relativeCreated = formatRelativeTime(event.$createdAt);

  return (
    <Link
      href={href}
      className="group block h-full outline-none cursor-pointer"
    >
      <article
        className={cn(
          "flex h-full flex-col rounded-[20px] border border-border-subtle bg-surface-raised p-5",
          "shadow-sm transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-border-default hover:shadow-md",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-primary-soft text-[13px] font-bold text-primary"
              aria-hidden
            >
              {getEventInitials(event.title)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-bold text-text-strong transition-colors group-hover:text-primary">
                {event.title}
              </h3>
              <p className="mt-0.5 truncate text-[13px] text-text-muted">
                {subtitle ?? `IEEE SB UoM · ${event.term} ${event.year}`}
              </p>
            </div>
          </div>
          {relativeCreated ? (
            <span className="shrink-0 text-[11px] font-medium text-text-placeholder whitespace-nowrap">
              {relativeCreated}
            </span>
          ) : null}
        </div>

        {event.description ? (
          <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-text-muted">
            {event.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <span
              key={pill}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                pill === formatEventStatus(event.status).toUpperCase()
                  ? badgeToneClassName[getEventStatusBadgeTone(event.status)]
                  : badgeToneClassName.primary,
              )}
            >
              {pill}
            </span>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-primary-mid/60 bg-primary-soft/70 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised">
              <CalendarDays className="size-4 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-text-muted">Starts</p>
              <p className="truncate text-[13px] font-semibold text-text-strong">
                {formatEventDate(event.start_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised">
              <MapPin className="size-4 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-text-muted">Term</p>
              <p className="truncate text-[13px] font-semibold text-text-strong">
                {event.term} · {event.year}
              </p>
            </div>
          </div>
          {showConclusionInInfo ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised">
                <ClipboardList className="size-4 text-primary" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-text-muted">Conclusion</p>
                <p className="truncate text-[13px] font-semibold text-text-strong">
                  {formatConclusionStatus(event.conclusion_status)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {visibleTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
            {overflowCount > 0 ? <TagChip>{`+${overflowCount}`}</TagChip> : null}
          </div>
        ) : null}

        <div className="mt-auto pt-4">
          <span
            className={cn(
              "flex w-full items-center justify-center rounded-full py-3 text-[13px] font-semibold text-white",
              "bg-gradient-to-r from-primary to-primary-hover shadow-sm",
              "transition group-hover:brightness-[1.03]",
            )}
          >
            View event
          </span>
        </div>
      </article>
    </Link>
  );
}
