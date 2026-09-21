import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { isVolunteerPreviewActive } from "@/features/access-control/server/view-mode";
import {
  getProfilesByUserIds,
  listProfiles,
} from "@/features/access-control/server/profiles";
import type { Profile } from "@/features/access-control/types";
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

function toVolunteerOption(profile: Profile) {
  return {
    googleEmail: profile.googleEmail,
    name: profile.name || profile.uomEmail || profile.googleEmail,
    uomEmail: profile.uomEmail,
    userId: profile.authUserId,
  };
}

export default async function EventDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const inVolunteerPreview = await isVolunteerPreviewActive(user.isAdmin);
  const effectiveIsAdmin = user.isAdmin && !inVolunteerPreview;

  if (!effectiveIsAdmin && !canVolunteer(user.profile)) {
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
  const canLoadFullVolunteerDirectory =
    permissions.canManageCommittee || permissions.canAssignRoles;

  const [assignments, committees, formConnections] = await Promise.all([
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
  ]);

  let volunteerOptions;

  if (canLoadFullVolunteerDirectory) {
    const profiles = await listProfiles();
    volunteerOptions = profiles
      .filter((profile) => profile.status === "ACTIVE" && profile.uomVerified)
      .map(toVolunteerOption);
  } else {
    const rosterUserIds = [
      ...assignments.map((assignment) => assignment.userId),
      ...committees.flatMap((committee) =>
        committee.members.map((member) => member.user_id),
      ),
    ];
    const profiles = await getProfilesByUserIds(rosterUserIds);
    volunteerOptions = profiles.map(toVolunteerOption);
  }

  const canManageFormConnections =
    permissions.canManageCommittee ||
    permissions.canEdit ||
    effectiveIsAdmin ||
    userEventRole === "Vice Chair" ||
    userEventRole === "Committee Lead";

  return (
    <AppShell active="events" user={user}>
      <EventDetail
        canManageFormConnections={canManageFormConnections}
        currentUserId={user.authUser.id}
        initialAssignments={assignments}
        initialCommittees={committees}
        initialEvent={event}
        initialFormConnections={formConnections}
        initialPermissions={permissions}
        initialVolunteers={volunteerOptions}
        isAdmin={effectiveIsAdmin}
        isVolunteer={canVolunteer(user.profile)}
        userEventRole={userEventRole}
      />
    </AppShell>
  );
}
