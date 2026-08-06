"use client";

import { CalendarDays } from "lucide-react";
import type { EventRoleAssignment } from "@/features/access-control/types";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { PageHeader } from "@/components/layout/page-header";
import { AppPage } from "@/components/layout/app-page";
import { Card, CardContent } from "@/components/ui/card";
import { EventListingCard } from "@/features/events/components/event-listing-card";
import { formatEventStatus } from "@/features/events/lib/event-ui";
import type { Event } from "@/features/events/types";

type UserEvent = {
  event: Event;
  role: EventRoleAssignment;
};

function formatRoleLabel(role: EventRoleAssignment) {
  return getEventRoleDisplayName(role.role, {
    chairCount: role.eventChairCount ?? 0,
  });
}

export function MyEvents({
  events,
}: Readonly<{
  events: UserEvent[];
}>) {
  return (
    <AppPage>
      <PageHeader
        title="My Events"
        description="Events where you hold an active committee responsibility."
      />

      {events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CalendarDays className="size-8 text-text-muted" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              You are not assigned to any events at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {events.map(({ event, role }) => (
            <EventListingCard
              key={event.$id}
              event={event}
              href={`/events/${event.$id}`}
              subtitle={`${event.reference} · ${formatRoleLabel(role)}`}
              primaryPills={[
                formatEventStatus(event.status).toUpperCase(),
                formatRoleLabel(role).toUpperCase(),
              ]}
              tagLabels={[
                formatRoleLabel(role),
                event.term,
                String(event.year),
                formatEventStatus(event.status),
                ...(role.committeeName ? [role.committeeName] : []),
              ]}
              showConclusionInInfo={false}
            />
          ))}
        </div>
      )}
    </AppPage>
  );
}
