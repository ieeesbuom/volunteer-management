import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { isVolunteerPreviewActive } from "@/features/access-control/server/view-mode";
import { EventList } from "@/features/events/components/EventList";
import { getEventsForUser } from "@/features/events/server/event-roles.server";
import { getEvents } from "@/features/events/server/event-service";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const inVolunteerPreview = await isVolunteerPreviewActive(user.isAdmin);
  const effectiveIsAdmin = user.isAdmin && !inVolunteerPreview;

  if (!effectiveIsAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { events: allEvents } = await getEvents({
    assignedEventIds: user.eventRoles.map((assignment) => assignment.eventId),
    isAdmin: effectiveIsAdmin,
    userId: user.authUser.id,
  });

  const myEvents = effectiveIsAdmin ? [] : await getEventsForUser(user.authUser.id);
  const showMyEventsTab = !effectiveIsAdmin && user.profile.uomVerified;

  return (
    <AppShell active="events" user={user}>
      <EventList
        allEvents={allEvents}
        myEvents={myEvents}
        showMyEventsTab={showMyEventsTab}
        user={user}
      />
    </AppShell>
  );
}
