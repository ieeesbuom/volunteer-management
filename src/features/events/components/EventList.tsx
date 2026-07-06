"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventStatus,
  getConclusionStatusBadgeTone,
  getEventStatusBadgeClassName,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Event } from "@/features/events/types";


import { useRouter, useSearchParams } from "next/navigation";
import type { EventRoleAssignment, SessionUser } from "@/features/access-control/types";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";

type UserEvent = {
  event: Event;
  role: EventRoleAssignment;
};

function formatRoleLabel(role: EventRoleAssignment) {
  return getEventRoleDisplayName(role.role, {
    chairCount: role.eventChairCount ?? 0,
  });
}

export function EventList({
  canCreate,
  allEvents,
  myEvents,
  showMyEventsTab,
  user,
}: Readonly<{
  canCreate: boolean;
  allEvents: Event[];
  myEvents: UserEvent[];
  showMyEventsTab: boolean;
  user?: SessionUser;
}>) {
  const isAdmin = user?.isAdmin ?? false;
  const userRoles = user?.eventRoles ?? [];
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Derive activeTab from URL search parameters to avoid setState in effect
  const tabParam = searchParams.get("tab");
  const activeTab = (tabParam === "my" && showMyEventsTab) ? "my" : "all";

  const handleTabChange = (tab: "all" | "my") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", "my");
    }
    router.replace(`/events?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Branch events and their lifecycle status."
        actions={
          canCreate ? (
            <Link className={buttonClasses({ variant: "primary" })} href="/events/new">
              <Plus className="size-4" aria-hidden="true" />
              Create Event
            </Link>
          ) : null
        }
      />

      {showMyEventsTab && (
        <div className="inline-flex flex-wrap gap-2 rounded-md border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "all"
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            All Events ({allEvents.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("my")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "my"
                ? "border-primary/30 bg-primary-soft text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
            )}
          >
            <UserRound className="size-4" aria-hidden="true" />
            My Events ({myEvents.length})
          </button>
        </div>
      )}

      {activeTab === "all" && allEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No events are available to display.</p>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "my" && myEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              You are not assigned to any events at this time.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "all" && allEvents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allEvents.map((event) => (
            <Link href={`/events/${event.$id}`} key={event.$id}>
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-surface-subtle">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">{event.title}</h3>
                      {isAdmin || userRoles.some((r) => r.eventId === event.$id && r.role === "Chair") ? (
                        <p className="mt-1 text-xs text-text-muted">{event.reference}</p>
                      ) : null}
                    </div>
                    <Badge
                      className={getEventStatusBadgeClassName(event.status)}
                      tone={getEventStatusBadgeTone(event.status)}
                    >
                      {formatEventStatus(event.status)}
                    </Badge>
                  </div>

                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Term / Year</dt>
                      <dd className="font-medium text-text-primary">
                        {event.term} · {event.year}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Start date</dt>
                      <dd className="font-medium text-text-primary">
                        {formatEventDate(event.start_date)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-text-secondary">Conclusion</dt>
                      <dd>
                        <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
                          {formatConclusionStatus(event.conclusion_status)}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      {activeTab === "my" && myEvents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {myEvents.map(({ event, role }) => (
            <Link href={`/events/${event.$id}`} key={event.$id}>
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-surface-subtle">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">{event.title}</h3>
                      {isAdmin || role.role === "Chair" ? (
                        <p className="mt-1 text-xs text-text-muted">{event.reference}</p>
                      ) : null}
                    </div>
                    <Badge tone="primary">{formatRoleLabel(role)}</Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={getEventStatusBadgeClassName(event.status)}
                      tone={getEventStatusBadgeTone(event.status)}
                    >
                      {formatEventStatus(event.status)}
                    </Badge>
                    {role.committeeName ? <Badge>{role.committeeName}</Badge> : null}
                  </div>

                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Term / Year</dt>
                      <dd className="font-medium text-text-primary">
                        {event.term} · {event.year}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-secondary">Start date</dt>
                      <dd className="font-medium text-text-primary">
                        {formatEventDate(event.start_date)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
