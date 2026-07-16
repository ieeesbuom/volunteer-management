import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer, hasSbRole } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { EXCOM_ROLES } from "@/lib/config";
import { listProfiles } from "@/features/access-control/server/profiles";
import { EventDetail } from "@/features/events/components/EventDetail";
import {
  getEventUserContext,
  getPermissionsForUser,
  isEventVisible,
} from "@/features/events/server/event-route-helpers";
import {
  listCommitteeMembersForCommittees,
  listCommitteesForEvent,
} from "@/features/events/server/committees.server";
import { getRoleAssignmentsForEvent } from "@/features/events/server/event-roles.server";
import { getEventById } from "@/features/events/server/event-service";
import { listFormConnectionsForCurrentUser } from "@/features/forms/server/form-connection-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    redirect("/verify-uom");
  }

  const { eventId } = await params;
  const event = await getEventById(eventId);

  if (!event) {
    redirect("/events");
  }

  const { userEventRole } = await getEventUserContext(eventId, user, event.reference);

  if (!isEventVisible(user, event, userEventRole)) {
    redirect("/events");
  }

  const permissions = getPermissionsForUser(user, event, userEventRole);
  const [assignments, committees, formConnections, profiles] = await Promise.all([
    getRoleAssignmentsForEvent(eventId),
    listCommitteesForEvent(eventId).then(async (items) => {
      const members = await listCommitteeMembersForCommittees(
        items.map((committee) => committee.$id),
      );
      const membersByCommittee = new Map<string, typeof members>();

      for (const member of members) {
        const current = membersByCommittee.get(member.committee_id) ?? [];
        membersByCommittee.set(member.committee_id, [...current, member]);
      }

      return items.map((committee) => ({
        ...committee,
        members: membersByCommittee.get(committee.$id) ?? [],
      }));
    }),
    listFormConnectionsForCurrentUser(eventId).catch(() => []),
    listProfiles(),
  ]);
  const volunteerOptions = profiles
    .filter((profile) => profile.status === "ACTIVE" && profile.uomVerified)
    .map((profile) => ({
      googleEmail: profile.googleEmail,
      name: profile.name || profile.uomEmail || profile.googleEmail,
      uomEmail: profile.uomEmail,
      userId: profile.authUserId,
    }));
  const canManageFormConnections =
    permissions.canManageCommittee ||
    permissions.canEdit ||
    user.isAdmin ||
    userEventRole === "Vice Chair" ||
    userEventRole === "Committee Lead";

  const canViewMoreInfo =
    user.isAdmin ||
    hasSbRole(user, [...EXCOM_ROLES, "SB Lead"]) ||
    userEventRole === "Chair" ||
    userEventRole === "Vice Chair";

  return (
    <AppShell active="events" user={user}>
      <EventDetail
        canManageFormConnections={canManageFormConnections}
        canViewMoreInfo={canViewMoreInfo}
        currentUserId={user.authUser.id}
        initialAssignments={assignments}
        initialCommittees={committees}
        initialEvent={event}
        initialFormConnections={formConnections}
        initialPermissions={permissions}
        initialVolunteers={volunteerOptions}
        isAdmin={user.isAdmin}
        userEventRole={userEventRole}
      />
    </AppShell>
  );
}
