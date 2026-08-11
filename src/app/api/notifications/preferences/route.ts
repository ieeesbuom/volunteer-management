import { NextResponse } from "next/server";
import {
  getNotificationPreferencesForCurrentUser,
  upsertNotificationPreferencesForCurrentUser,
} from "@/features/notifications/server/notification-service";
import { notificationPreferencesSchema } from "@/features/notifications/validation";
import { jsonRouteError } from "@/server/errors";

export async function GET() {
  try {
    const preference = await getNotificationPreferencesForCurrentUser();

    return NextResponse.json({ preference });
  } catch (error) {
    return jsonRouteError(error, "Could not load notification preferences.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = notificationPreferencesSchema.parse(await request.json());
    const preference = await upsertNotificationPreferencesForCurrentUser(body);

    return NextResponse.json({ preference });
  } catch (error) {
    return jsonRouteError(error, "Could not save notification preferences.");
  }
}
