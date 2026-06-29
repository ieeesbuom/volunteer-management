import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EventList } from "@/features/events/components/EventList";
import { canCreateEvent } from "@/features/events/server/event-route-helpers";
import { getEvents } from "@/features/events/server/event-service";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { events } = await getEvents({
    assignedEventIds: user.eventRoles.map((assignment) => assignment.eventId),
    isAdmin: user.isAdmin,
    userId: user.authUser.id,
  });

  return (
    <AppShell active="events" user={user}>
      <EventList canCreate={canCreateEvent(user)} events={events} />
    </AppShell>
  );
}
