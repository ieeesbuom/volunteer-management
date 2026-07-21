"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus, UserRound, Inbox } from "lucide-react";
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
import type { Event, EventStatus } from "@/features/events/types";


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

function getEventBorderClass(status: EventStatus) {
  switch (status) {
    case "draft": return "border-l-neutral";
    case "planning": return "border-l-primary";
    case "published": return "border-l-primary";
    case "ongoing": return "border-l-success";
    case "pending_conclusion": return "border-l-warning";
    case "closed": return "border-l-border-strong";
    default: return "border-l-border-strong";
  }
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
        <div className="flex border-b border-border-subtle mb-6">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={cn(
              "h-10 px-4 text-[14px] font-medium relative transition-colors cursor-pointer",
              activeTab === "all"
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text-body"
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" />
              All Events ({allEvents.length})
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("my")}
            className={cn(
              "h-10 px-4 text-[14px] font-medium relative transition-colors cursor-pointer",
              activeTab === "my"
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text-body"
            )}
          >
            <div className="flex items-center gap-2">
              <UserRound className="size-4" aria-hidden="true" />
              My Events ({myEvents.length})
            </div>
          </button>
        </div>
      )}

      {activeTab === "all" && allEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Inbox className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-text-strong">No events found</p>
              <p className="mt-1 text-[14px] text-text-muted">There are no events available to display right now.</p>
            </div>
            {canCreate && (
              <Link className={buttonClasses({ variant: "primary", className: "mt-2" })} href="/events/new">
                <Plus className="size-4" aria-hidden="true" />
                Create Event
              </Link>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "my" && myEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <UserRound className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-text-strong">No assigned events</p>
              <p className="mt-1 text-[14px] text-text-muted">You are not assigned to any events at this time.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "all" && allEvents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allEvents.map((event) => (
            <Link href={`/events/${event.$id}`} key={event.$id} className="group outline-none">
              <Card navigable className={cn("h-full border-l-[4px]", getEventBorderClass(event.status))}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors">{event.title}</h3>
                      {isAdmin || userRoles.some((r) => r.eventId === event.$id && r.role === "Chair") ? (
                        <p className="mt-1 text-[12px] text-text-muted">{event.reference}</p>
                      ) : null}
                      {event.description && (
                        <p className="mt-1.5 text-[13px] text-text-muted line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    <Badge
                      className={getEventStatusBadgeClassName(event.status)}
                      tone={getEventStatusBadgeTone(event.status)}
                    >
                      {formatEventStatus(event.status)}
                    </Badge>
                  </div>

                  <dl className="grid gap-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-text-secondary">Term / Year</dt>
                      <dd>
                        <Badge tone="neutral">{event.term} · {event.year}</Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 pt-1">
                      <dt className="text-text-secondary">Start date</dt>
                      <dd className="font-medium text-text-primary">
                        {formatEventDate(event.start_date)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
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
            <Link href={`/events/${event.$id}`} key={event.$id} className="group outline-none">
              <Card navigable className={cn("h-full border-l-[4px]", getEventBorderClass(event.status))}>
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors">{event.title}</h3>
                      {isAdmin || role.role === "Chair" ? (
                        <p className="mt-1 text-[12px] text-text-muted">{event.reference}</p>
                      ) : null}
                      {event.description && (
                        <p className="mt-1.5 text-[13px] text-text-muted line-clamp-2">{event.description}</p>
                      )}
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

                  <dl className="grid gap-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <dt className="text-text-secondary">Term / Year</dt>
                      <dd>
                        <Badge tone="neutral">{event.term} · {event.year}</Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 pt-1">
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
