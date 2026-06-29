import "server-only";

import type { SessionUser } from "@/features/access-control/types";
import { hasEventRole, normalizeEventReference } from "@/features/access-control/lib/rules";
import {
  listConclusionReportsForUser,
  listConclusionReports,
} from "@/features/reports/server/conclusion-service";
import {
  getRecognitionSnapshot,
  listEventSummaries,
} from "@/features/reports/server/recognition";
import { listVolunteerProfiles } from "@/features/reports/server/volunteer-profile";
import { listProfiles } from "@/features/access-control/server/profiles";
import type { ReportEvent } from "@/features/reports/types";
import { listEvents } from "@/features/events/server/event-service";
import type { Event } from "@/features/events/types";

const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const;

function toReportEventStatus(event: Event): ReportEvent["status"] {
  return event.status.toUpperCase() as ReportEvent["status"];
}

async function listPendingConclusionEvents(user: SessionUser): Promise<ReportEvent[]> {
  const events = await listEvents();

  return events
    .filter(
      (event) =>
        event.status === "ongoing" ||
        event.status === "pending_conclusion" ||
        event.conclusion_status === "rejected",
    )
    .filter(
      (event) => user.isAdmin || hasEventRole(user, event.$id, [...EVENT_LEAD_ROLES]),
    )
    .map((event) => ({
      eventId: normalizeEventReference(event.$id),
      eventTitle: event.title,
      heldOn: event.end_date ?? event.start_date,
      status: toReportEventStatus(event),
      summary:
        event.conclusion_status === "rejected"
          ? "Conclusion report needs changes."
          : event.status === "pending_conclusion"
            ? "Conclusion report is awaiting admin review."
            : "Ready for a structured conclusion report.",
    }));
}

async function countActiveProfiles() {
  const profiles = await listProfiles();
  return profiles.filter((profile) => profile.status === "ACTIVE").length;
}

type ReportsPageDataOptions = {
  includeEvents?: boolean;
  includeRecognition?: boolean;
  includeReports?: boolean;
  includeSummaries?: boolean;
  includeVolunteerCount?: boolean;
  includeVolunteerExports?: boolean;
};

const DEFAULT_REPORTS_PAGE_OPTIONS = {
  includeEvents: true,
  includeRecognition: true,
  includeReports: true,
  includeSummaries: true,
  includeVolunteerCount: true,
  includeVolunteerExports: true,
} satisfies Required<ReportsPageDataOptions>;

export async function getReportsPageData(
  user: SessionUser,
  options: ReportsPageDataOptions = DEFAULT_REPORTS_PAGE_OPTIONS,
) {
  const resolvedOptions = { ...DEFAULT_REPORTS_PAGE_OPTIONS, ...options };
  const [
    events,
    reports,
    summaries,
    volunteers,
    volunteerCount,
    recognition,
  ] = await Promise.all([
    resolvedOptions.includeEvents ? listPendingConclusionEvents(user) : Promise.resolve([]),
    resolvedOptions.includeReports
      ? user.isAdmin
        ? listConclusionReports()
        : listConclusionReportsForUser(user)
      : Promise.resolve([]),
    resolvedOptions.includeSummaries ? listEventSummaries() : Promise.resolve([]),
    resolvedOptions.includeVolunteerExports && user.isAdmin
      ? listVolunteerProfiles()
      : Promise.resolve([]),
    resolvedOptions.includeVolunteerCount && user.isAdmin
      ? countActiveProfiles()
      : Promise.resolve(0),
    resolvedOptions.includeRecognition
      ? getRecognitionSnapshot(new Date(), { preferCached: true })
      : Promise.resolve({ hallOfFame: [], volunteerOfTheMonth: null }),
  ]);

  return {
    events,
    hallOfFame: recognition.hallOfFame,
    reports,
    summaries,
    volunteerCount,
    volunteerOfTheMonth: recognition.volunteerOfTheMonth,
    volunteers,
  };
}
