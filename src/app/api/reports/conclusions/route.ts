import { NextResponse } from "next/server";
import { requireAuth } from "@/features/access-control/server/current-user";
import {
  createConclusionReportRecord,
  listConclusionReportsForUser,
} from "@/features/reports/server/conclusion-service";
import { createConclusionReportSchema } from "@/features/reports/lib/validation";
import { jsonRouteError } from "@/server/errors";

export async function GET() {
  try {
    const user = await requireAuth();
    const reports = await listConclusionReportsForUser(user);

    return NextResponse.json({ reports });
  } catch (error) {
    return jsonRouteError(error, "Could not list conclusion reports.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = createConclusionReportSchema.parse(await request.json());
    const report = await createConclusionReportRecord(user, body);

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return jsonRouteError(error, "Could not create conclusion report.");
  }
}
