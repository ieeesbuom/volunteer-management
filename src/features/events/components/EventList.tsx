"use client";

import { cn } from "@/lib/utils";
import { CalendarDays, UserRound, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AppPage } from "@/components/layout/app-page";
import { Card, CardContent } from "@/components/ui/card";
import { EventListingCard } from "@/features/events/components/event-listing-card";
import {
  canViewEventLifecycle,
  isEventVisibleToUser,
} from "@/features/events/lib/event-permissions";
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

function getUserEventRole(user: SessionUser | undefined, event: Event) {
  if (!user) {
    return null;
  }

  const assignment = user.eventRoles.find(
    (role) =>
      role.active !== false &&
      (role.eventId === event.$id ||
        (event.reference != null && role.eventId === event.reference)),
  );

  return assignment?.role ?? null;
}

function buildAllEventsTags(event: Event, showLifecycle: boolean) {
  return [
    event.term,
    String(event.year),
    ...(showLifecycle ? [formatConclusionStatus(event.conclusion_status)] : []),
    event.reference,
  ].filter(Boolean);
}

function buildMyEventsTags(
  event: Event,
  role: EventRoleAssignment,
  showLifecycle: boolean,
) {
  const tags = [
    formatRoleLabel(role),
    event.term,
    String(event.year),
    ...(showLifecycle ? [formatEventStatus(event.status)] : []),
  ];
  if (role.committeeName) {
    tags.push(role.committeeName);
  }
  return tags;
}

export function EventList({
  allEvents,
  myEvents,
  showMyEventsTab,
  user,
}: Readonly<{
  canCreate?: boolean;
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
        description="Branch events you can browse and join."
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
            const showLifecycle = canViewEventLifecycle(isAdmin, event.$id, userRoles);
            const userEventRole = getUserEventRole(user, event);
            const canOpenEvent = user
              ? isEventVisibleToUser(user.authUser.id, isAdmin, event, userEventRole)
              : false;
            return (
              <EventListingCard
                key={event.$id}
                event={event}
                href={canOpenEvent ? `/events/${event.$id}` : undefined}
                subtitle={
                  showReference
                    ? `${event.reference} · IEEE SB UoM`
                    : `IEEE SB UoM · ${event.term} ${event.year}`
                }
                showLifecycle={showLifecycle}
                showConclusionInInfo={showLifecycle}
                tagLabels={buildAllEventsTags(event, showLifecycle).filter(
                  (tag) => tag !== event.reference,
                )}
              />
            );
          })}
        </div>
      ) : null}

      {activeTab === "my" && myEvents.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {myEvents.map(({ event, role }) => {
            const showReference = isAdmin || role.role === "Chair";
            const showLifecycle = canViewEventLifecycle(isAdmin, event.$id, [
              ...userRoles,
              role,
            ]);
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
                primaryPills={
                  showLifecycle
                    ? [
                        formatEventStatus(event.status).toUpperCase(),
                        formatRoleLabel(role).toUpperCase(),
                      ]
                    : [formatRoleLabel(role).toUpperCase()]
                }
                tagLabels={buildMyEventsTags(event, role, showLifecycle)}
                showLifecycle={showLifecycle}
                showConclusionInInfo={false}
              />
            );
          })}
        </div>
      ) : null}
    </AppPage>
  );
}
