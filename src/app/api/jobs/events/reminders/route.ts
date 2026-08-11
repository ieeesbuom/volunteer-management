import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getEventById,
  listEvents,
} from "@/features/events/server/event-service";
import type { Event } from "@/features/events/types";
import { getEventNotificationContext } from "@/features/notifications/server/workflow-recipients";
import { sendEventReminderNotificationsJob } from "@/jobs/send-event-reminder-notifications-job";
import { jsonRouteError } from "@/server/errors";
import { assertTrustedJobRequest, readOptionalJsonBody } from "@/server/internal-job-auth";

const reminderRequestSchema = z
  .object({
    dryRun: z.boolean().default(true),
    eventId: z.string().trim().min(1).max(128).optional(),
    referenceDate: z.string().datetime().optional(),
    windowHours: z.number().int().min(1).max(168).default(24),
  })
  .strict();

export async function POST(request: Request) {
  try {
    assertTrustedJobRequest(request);
    const input = reminderRequestSchema.parse(await readOptionalJsonBody(request));
    const events = await resolveReminderEvents(input);
    const results = [];

    for (const event of events) {
      const notificationContext = await getEventNotificationContext(event.$id);

      if (notificationContext.recipientUserIds.length === 0) {
        results.push({
          eventId: event.$id,
          eventTitle: event.title,
          reason: "No active verified event recipients.",
          skipped: true,
        });
        continue;
      }

      results.push({
        eventId: event.$id,
        eventTitle: event.title,
        result: await sendEventReminderNotificationsJob({
          dryRun: input.dryRun,
          eventId: event.$id,
          eventTitle: event.title,
          linkHref: `/events/${event.$id}`,
          recipientUserIds: notificationContext.recipientUserIds,
          startsAt: event.start_date,
        }),
      });
    }

    return NextResponse.json({
      dryRun: input.dryRun,
      processed: results.length,
      results,
    });
  } catch (error) {
    return jsonRouteError(error, "Event reminder job failed.");
  }
}

async function resolveReminderEvents(input: z.infer<typeof reminderRequestSchema>) {
  if (input.eventId) {
    const event = await getEventById(input.eventId);
    return event ? [event] : [];
  }

  const referenceDate = input.referenceDate ? new Date(input.referenceDate) : new Date();
  const windowEnd = new Date(referenceDate.getTime() + input.windowHours * 60 * 60 * 1000);
  const events = await listEvents();

  return events.filter((event) => isReminderCandidate(event, referenceDate, windowEnd));
}

function isReminderCandidate(event: Event, referenceDate: Date, windowEnd: Date) {
  if (event.status !== "published" && event.status !== "ongoing") {
    return false;
  }

  const startsAt = new Date(event.start_date);
  return startsAt >= referenceDate && startsAt <= windowEnd;
}
