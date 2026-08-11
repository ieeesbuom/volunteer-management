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
import { getEventById, listEvents } from "@/features/events/server/event-service";
import type { Event } from "@/features/events/types";

const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const;

function normalizeStoredEventStatus(status: string) {
  return status.trim().toLowerCase();
}

function toReportEventStatus(event: Event): ReportEvent["status"] {
  return normalizeStoredEventStatus(event.status).toUpperCase() as ReportEvent["status"];
}

function isEligibleForConclusionReporting(event: Event) {
  const status = normalizeStoredEventStatus(event.status);

  return (
    status === "ongoing" ||
    status === "pending_conclusion" ||
    event.conclusion_status === "rejected"
  );
}

function toReportEvent(event: Event): ReportEvent {
  const status = normalizeStoredEventStatus(event.status);

  return {
    eventId: normalizeEventReference(event.$id),
    eventTitle: event.title,
    heldOn: event.end_date ?? event.start_date,
    status: toReportEventStatus(event),
    summary:
      event.conclusion_status === "rejected"
        ? "Conclusion report needs changes."
        : status === "pending_conclusion"
          ? "Conclusion report is awaiting admin review."
          : "Ready for a conclusion report.",
  };
}

function userCanManageEventConclusion(user: SessionUser, event: Event) {
  return (
    user.isAdmin ||
    hasEventRole(user, event.$id, [...EVENT_LEAD_ROLES], event.reference)
  );
}

async function listPendingConclusionEvents(user: SessionUser): Promise<ReportEvent[]> {
  const events = await listEvents();

  return events
    .filter(isEligibleForConclusionReporting)
    .filter((event) => userCanManageEventConclusion(user, event))
    .map(toReportEvent);
}

export async function appendRequestedConclusionEvent(
  user: SessionUser,
  events: ReportEvent[],
  requestedEventId?: string,
): Promise<ReportEvent[]> {
  if (!requestedEventId) {
    return events;
  }

  const normalizedRequestedId = normalizeEventReference(requestedEventId);
  if (events.some((event) => event.eventId === normalizedRequestedId)) {
    return events;
  }

  const event = await getEventById(requestedEventId);
  if (!event || !userCanManageEventConclusion(user, event)) {
    return events;
  }

  if (!isEligibleForConclusionReporting(event)) {
    return events;
  }

  return [toReportEvent(event), ...events];
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
