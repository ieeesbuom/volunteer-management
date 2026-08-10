import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { listEventsByIds } from "@/features/events/server/event-service";
import { createAppwriteFormConnectionRepository } from "@/features/forms/server/form-connection-repository";
import {
  isFormEligibleForDashboard,
  isOpenOpportunityAudience,
  shouldExcludeAssignedEventOpportunity,
} from "@/features/forms/lib/audience";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const formRepo = createAppwriteFormConnectionRepository();
  const allConnections = await formRepo.list({ limit: 100 });
  const availableForms = allConnections.filter((connection) =>
    isFormEligibleForDashboard(connection, user),
  );

  const assignedEventIds = new Set(user.eventRoles.map((role) => role.eventId));
  const visibleForms = availableForms.filter(
    (connection) => !shouldExcludeAssignedEventOpportunity(connection, assignedEventIds),
  );

  const opportunityEvents =
    visibleForms.length > 0
      ? await listEventsByIds(visibleForms.map((form) => form.eventId))
      : [];

  const eventsMap = new Map(opportunityEvents.map((event) => [event.$id, event]));
  const allowedStatuses = new Set(["planning", "published", "ongoing"]);

  const opportunityList = visibleForms
    .map((conn) => ({ conn, event: eventsMap.get(conn.eventId) }))
    .filter(({ conn, event }) => {
      if (!event || !allowedStatuses.has(event.status)) {
        return false;
      }

      // Legacy events may store a reference id that also appears in role assignments.
      if (
        event.reference &&
        assignedEventIds.has(event.reference) &&
        isOpenOpportunityAudience(conn)
      ) {
        return false;
      }

      return true;
    });

  return (
    <AppShell active="dashboard" user={user}>
      <AppPage className="space-y-0 pb-0">
        <Suspense fallback={null}>
          <DashboardOverview user={user} opportunityList={opportunityList} />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
