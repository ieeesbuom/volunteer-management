import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConclusionApprovalPanel } from "@/features/reports/components/conclusion-approval-panel";
import { ConclusionsPageContent } from "@/features/reports/components/conclusions-page-content";
import { ReportsSection } from "@/features/reports/components/reports-section";
import { REPORTS_ROUTE_TITLES } from "@/features/reports/lib/page-titles";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function ConclusionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ eventId?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (!canAccessConclusionsTab(user)) {
    redirect("/reports/recognition");
  }

  const data = await getReportsPageData(user, {
    includeEvents: true,
    includeRecognition: false,
    includeReports: true,
    includeSummaries: false,
    includeVolunteerCount: false,
    includeVolunteerExports: false,
  });
  const requestedEventId = (await searchParams)?.eventId;
  const draftEvent =
    data.events.find((event) => event.eventId === requestedEventId) ?? data.events[0];
  const orderedEvents = draftEvent
    ? [
        draftEvent,
        ...data.events.filter((event) => event.eventId !== draftEvent.eventId),
      ]
    : data.events;
  const draftReport =
    data.reports.find((report) => report.eventId === draftEvent?.eventId) ?? null;

  return (
    <ReportsSection
      canAccessConclusions={canAccessConclusionsTab(user)}
      isAdmin={user.isAdmin}
      title={REPORTS_ROUTE_TITLES["/reports/conclusions"]}
      description={
        user.isAdmin
          ? "Create, review, approve, and export event conclusion reports."
          : "Create and submit structured event conclusion reports."
      }
    >
      <ConclusionsPageContent
        events={orderedEvents}
        initialReport={draftReport}
        initialReports={data.reports}
        showReportList={!user.isAdmin}
      />

      {user.isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" aria-hidden="true" />
              Review and export
            </CardTitle>
            <CardDescription>
              Approve or reject submitted reports, then export approved reports as PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConclusionApprovalPanel initialReports={data.reports} />
          </CardContent>
        </Card>
      ) : null}
    </ReportsSection>
  );
}
