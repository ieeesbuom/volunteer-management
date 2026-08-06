import { NextResponse } from "next/server";
import {
  getDashboardLayoutForCurrentUser,
  upsertDashboardLayoutForCurrentUser,
} from "@/features/dashboard/server/dashboard-layout-service";
import { jsonError, routeErrorMessage, routeErrorStatus } from "@/server/errors";

export async function GET() {
  try {
    const layout = await getDashboardLayoutForCurrentUser();
    return NextResponse.json({ layout });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not load dashboard layout."),
      routeErrorStatus(error),
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const stored = await upsertDashboardLayoutForCurrentUser(body.layout ?? body);
    return NextResponse.json({ layout: stored.layout });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not save dashboard layout."),
      routeErrorStatus(error),
    );
  }
}
