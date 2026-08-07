"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/features/events/types";
import {
  formatEventStatus,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import { WidgetEmptyState } from "@/features/dashboard/components/widgets/widget-empty-state";

export function AnalyticsEventTableWidget() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/events?limit=5");
        const data = (await res.json()) as { events?: Event[]; error?: string };

        if (!res.ok) {
          if (!cancelled) {
            setError(data.error ?? "Could not load events.");
            setEvents([]);
          }
          return;
        }

        if (!cancelled) {
          setError(null);
          setEvents(data.events ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load events.");
          setEvents([]);
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

  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6">
      <div className="flex shrink-0 items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary-mid bg-primary-soft text-primary">
            <BarChart3 className="size-4" />
          </div>
          <h2 className="truncate text-[15px] font-bold text-text-strong sm:text-[16px]">
            Recent events
          </h2>
        </div>
        <Link
          href="/events"
          className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-bg-base px-3.5 py-1.5 text-[12px] font-semibold text-text-body transition-colors hover:bg-neutral-soft"
        >
          See all
        </Link>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="py-4 text-[13px] text-danger">{error}</p>
        ) : events.length === 0 ? (
          <WidgetEmptyState
            title="No events yet"
            description="Events you can access will appear here once they are created."
            className="min-h-[180px] border-none bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
            <table className="w-full min-w-[480px] border-collapse text-left text-[12px] sm:text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-base text-[11px] font-semibold text-text-muted sm:text-[12px]">
                  <th className="px-3.5 py-2.5 sm:px-4">Event</th>
                  <th className="px-3.5 py-2.5 sm:px-4">Term</th>
                  <th className="px-3.5 py-2.5 text-right sm:px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/80 bg-surface-raised">
                {events.map((event) => (
                  <tr key={event.$id} className="transition-colors hover:bg-bg-base">
                    <td className="px-3.5 py-3 sm:px-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary-mid bg-primary-soft text-primary">
                          <CalendarDays className="size-3.5" />
                        </div>
                        <Link
                          href={`/events/${event.$id}`}
                          className="max-w-[180px] truncate text-[13px] font-bold text-text-strong transition-colors hover:text-primary sm:max-w-xs"
                        >
                          {event.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-text-body sm:px-4">
                      {event.term} {event.year}
                    </td>
                    <td className="px-3.5 py-3 text-right sm:px-4">
                      <Badge tone={getEventStatusBadgeTone(event.status)} className="text-[11px]">
                        {formatEventStatus(event.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
