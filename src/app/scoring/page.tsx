import { requireAuth } from "@/features/access-control/server/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ScoringDashboard } from "@/features/scoring/components/scoring-dashboard";
import {
  listAllActiveEvents,
  listVolunteers,
} from "@/features/scoring/server/actions";

export const dynamic = "force-dynamic";

type ScoringPageProps = {
  searchParams?: Promise<{
    eventId?: string;
  }>;
};

export default async function ScoringPage({ searchParams }: ScoringPageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const selectedEventId = params?.eventId;
  const [initialEvents, initialVolunteers] = await Promise.all([
    user.isAdmin ? listAllActiveEvents().catch(() => []) : Promise.resolve([]),
    user.isAdmin || selectedEventId
      ? listVolunteers(selectedEventId).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <AppShell active="scoring" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Scoring & Leaderboard"
          description="Track volunteer contributions, manage participation, enter grades, and view points standings."
        />
        <ScoringDashboard
          initialEvents={initialEvents}
          initialVolunteers={initialVolunteers}
          initialVolunteersEventId={selectedEventId ?? ""}
          user={user}
        />
      </div>
    </AppShell>
  );
}
