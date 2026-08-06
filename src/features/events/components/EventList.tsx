"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus, UserRound, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AppPage } from "@/components/layout/app-page";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventListingCard } from "@/features/events/components/event-listing-card";
import {
  formatConclusionStatus,
  formatEventStatus,
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

function buildAllEventsTags(event: Event) {
  return [
    event.term,
    String(event.year),
    formatConclusionStatus(event.conclusion_status),
    event.reference,
  ].filter(Boolean);
}

function buildMyEventsTags(event: Event, role: EventRoleAssignment) {
  const tags = [
    formatRoleLabel(role),
    event.term,
    String(event.year),
    formatEventStatus(event.status),
  ];
  if (role.committeeName) {
    tags.push(role.committeeName);
  }
  return tags;
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

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "my" && showMyEventsTab ? "my" : "all";

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
    <AppPage>
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
        <div className="mb-4 flex overflow-x-auto border-b border-border-subtle">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={cn(
              "relative h-10 cursor-pointer px-4 text-[14px] font-medium transition-colors",
              activeTab === "all"
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text-body",
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
              "relative h-10 cursor-pointer px-4 text-[14px] font-medium transition-colors",
              activeTab === "my"
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text-body",
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
              <p className="mt-1 text-[14px] text-text-muted">
                There are no events available to display right now.
              </p>
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
              <p className="mt-1 text-[14px] text-text-muted">
                You are not assigned to any events at this time.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "all" && allEvents.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {allEvents.map((event) => {
            const showReference =
              isAdmin || userRoles.some((r) => r.eventId === event.$id && r.role === "Chair");
            return (
              <EventListingCard
                key={event.$id}
                event={event}
                href={`/events/${event.$id}`}
                subtitle={
                  showReference
                    ? `${event.reference} · IEEE SB UoM`
                    : `IEEE SB UoM · ${event.term} ${event.year}`
                }
                tagLabels={buildAllEventsTags(event).filter((tag) => tag !== event.reference)}
              />
            );
          })}
        </div>
      ) : null}

      {activeTab === "my" && myEvents.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {myEvents.map(({ event, role }) => {
            const showReference = isAdmin || role.role === "Chair";
            return (
              <EventListingCard
                key={event.$id}
                event={event}
                href={`/events/${event.$id}`}
                subtitle={
                  showReference
                    ? `${event.reference} · ${formatRoleLabel(role)}`
                    : `${formatRoleLabel(role)} · IEEE SB UoM`
                }
                primaryPills={[
                  formatEventStatus(event.status).toUpperCase(),
                  formatRoleLabel(role).toUpperCase(),
                ]}
                tagLabels={buildMyEventsTags(event, role)}
                showConclusionInInfo={false}
              />
            );
          })}
        </div>
      ) : null}
    </AppPage>
  );
}
