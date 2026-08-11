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
import {
  appendRequestedConclusionEvent,
  getReportsPageData,
} from "@/features/reports/server/page-data";
import { normalizeEventReference } from "@/features/access-control/lib/rules";
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

  const requestedEventId = (await searchParams)?.eventId;
  const data = await getReportsPageData(user, {
    includeEvents: true,
    includeRecognition: false,
    includeReports: true,
    includeSummaries: false,
    includeVolunteerCount: false,
    includeVolunteerExports: false,
  });
  const events = await appendRequestedConclusionEvent(user, data.events, requestedEventId);
  const normalizedRequestedEventId = requestedEventId
    ? normalizeEventReference(requestedEventId)
    : undefined;
  const draftEvent =
    events.find((event) => event.eventId === normalizedRequestedEventId) ?? events[0];
  const orderedEvents = draftEvent
    ? [draftEvent, ...events.filter((event) => event.eventId !== draftEvent.eventId)]
    : events;
  const draftReport =
    data.reports.find((report) => report.eventId === draftEvent?.eventId) ?? null;

  return (
    <ReportsSection
      canAccessConclusions={canAccessConclusionsTab(user)}
      isAdmin={user.isAdmin}
      title={REPORTS_ROUTE_TITLES["/reports/conclusions"]}
      description={
        user.isAdmin
          ? "Review uploaded conclusion reports and approve or reject them."
          : "Upload a PDF report and optional notes for your events."
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
              Review reports
            </CardTitle>
            <CardDescription>
              Approve or reject submitted reports. Open the uploaded PDF from the selected report.
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
