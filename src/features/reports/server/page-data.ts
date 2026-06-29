import "server-only";

import type { SessionUser } from "@/features/access-control/types";
import { hasEventRole, normalizeEventReference } from "@/features/access-control/lib/rules";
import {
  listConclusionReportsForUser,
  listConclusionReports,
} from "@/features/reports/server/conclusion-service";
import {
  getHallOfFame,
  getVolunteerOfTheMonth,
  listEventSummaries,
} from "@/features/reports/server/recognition";
import { listVolunteerProfiles } from "@/features/reports/server/volunteer-profile";
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

export async function getReportsPageData(user: SessionUser) {
  const [events, reports, summaries, volunteers, volunteerOfTheMonth, hallOfFame] = await Promise.all([
    listPendingConclusionEvents(user),
    user.isAdmin ? listConclusionReports() : listConclusionReportsForUser(user),
    listEventSummaries(),
    user.isAdmin ? listVolunteerProfiles() : Promise.resolve([]),
    getVolunteerOfTheMonth(),
    getHallOfFame(),
  ]);

  return {
    events,
    hallOfFame,
    reports,
    summaries,
    volunteerOfTheMonth,
    volunteers,
  };
}
