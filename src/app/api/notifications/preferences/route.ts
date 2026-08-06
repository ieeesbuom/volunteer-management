import { NextResponse } from "next/server";
import {
  getNotificationPreferencesForCurrentUser,
  upsertNotificationPreferencesForCurrentUser,
} from "@/features/notifications/server/notification-service";
import { notificationPreferencesSchema } from "@/features/notifications/validation";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

export async function GET() {
  try {
    const preference = await getNotificationPreferencesForCurrentUser();

    return NextResponse.json({ preference });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not load notification preferences."),
      routeErrorStatus(error),
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = notificationPreferencesSchema.parse(await request.json());
    const preference = await upsertNotificationPreferencesForCurrentUser(body);

    return NextResponse.json({ preference });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not save notification preferences."),
      routeErrorStatus(error),
    );
  }
}
