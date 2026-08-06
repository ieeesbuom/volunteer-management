import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { listEventsByIds } from "@/features/events/server/event-service";
import { createAppwriteFormConnectionRepository } from "@/features/forms/server/form-connection-repository";
import { isEligibleForGlobalDashboard } from "@/features/forms/lib/audience";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { getDashboardLayoutForUserId } from "@/features/dashboard/server/dashboard-layout-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const formRepo = createAppwriteFormConnectionRepository();
  const [allConnections, savedLayout] = await Promise.all([
    formRepo.list({ limit: 100 }),
    getDashboardLayoutForUserId(user.authUser.id).catch(() => null),
  ]);
  const activeRegistrations = allConnections.filter(isEligibleForGlobalDashboard);

  const assignedEventIds = new Set(user.eventRoles.map((r) => r.eventId));
  const openOpportunities = activeRegistrations.filter(
    (conn) => !assignedEventIds.has(conn.eventId)
  );

  const opportunityEvents = openOpportunities.length > 0
    ? await listEventsByIds(openOpportunities.map((o) => o.eventId))
    : [];

  const eventsMap = new Map(opportunityEvents.map((e) => [e.$id, e]));
  const allowedStatuses = ["planning", "published", "ongoing"];
  const opportunityList = openOpportunities
    .map((conn) => ({ conn, event: eventsMap.get(conn.eventId) }))
    .filter(({ event }) => {
      if (!event) return false;
      if (!allowedStatuses.includes(event.status)) return false;
      if (event.reference && assignedEventIds.has(event.reference)) return false;
      return true;
    });

  return (
    <AppShell active="dashboard" user={user}>
      <AppPage className="space-y-0 pb-0">
        <Suspense fallback={null}>
          <DashboardOverview
            user={user}
            opportunityList={opportunityList}
            initialLayout={savedLayout}
          />
        </Suspense>
      </AppPage>
    </AppShell>
  );
}
