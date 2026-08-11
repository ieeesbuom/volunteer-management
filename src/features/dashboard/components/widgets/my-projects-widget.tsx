"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, ExternalLink } from "lucide-react";
import { userIsEventChair } from "@/features/access-control/lib/rules";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";
import { Badge } from "@/components/ui/badge";
import {
  formatEventStatus,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";

export function MyProjectsWidget() {
  const { opportunityList, user } = useDashboardData();
  const isChair = userIsEventChair(user);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5 sm:p-6">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary-mid bg-primary-soft text-primary">
            <ClipboardList className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-text-strong sm:text-[16px]">
              Available Forms
            </h2>
            <p className="text-[12px] text-text-muted">
              {isChair
                ? "Active forms on events you chair"
                : "Forms open to you based on audience and schedule"}
            </p>
          </div>
        </div>

        <Link
          href="/events"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[12px] font-semibold text-text-body transition-colors hover:bg-neutral-soft"
        >
          All events
        </Link>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        {opportunityList.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-base text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 font-semibold">Event</th>
                  <th className="px-4 py-2.5 font-semibold">Form</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-raised">
                {opportunityList.map(({ conn, event }) => (
                  <tr key={conn.id} className="transition-colors hover:bg-bg-base/80">
                    <td className="px-4 py-3">
                      <span
                        className="block max-w-[220px] truncate font-semibold text-text-strong"
                        title={event?.title || conn.title}
                      >
                        {event?.title || "Event"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[220px] truncate text-text-body" title={conn.title}>
                        {conn.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event ? (
                        <Badge tone={getEventStatusBadgeTone(event.status)} className="text-[11px]">
                          {formatEventStatus(event.status)}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="text-[11px]">
                          Open
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {conn.formUrl ? (
                        <a
                          href={conn.formUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                        >
                          Open
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-[12px] text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-base/60 px-6 py-8 text-center">
            <p className="text-[14px] font-semibold text-text-strong">No forms available for you</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-text-muted">
              {isChair
                ? "Forms for your chaired events appear here when they are active and within schedule."
                : "Forms appear here when they are open and your role matches the form audience."}
            </p>
            <Link
              href="/events"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
            >
              Browse events <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
