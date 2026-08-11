import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { listAuditLogs } from "@/features/system-settings/server/settings";
import { auditLogsQuerySchema } from "@/features/system-settings/validation";
import { jsonRouteError } from "@/server/errors";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const query = auditLogsQuerySchema.parse({
      action: searchParams.get("action") ?? undefined,
      actorUserId: searchParams.get("actorUserId") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      targetId: searchParams.get("targetId") ?? undefined,
    });
    const auditPage = await listAuditLogs({
      action: query.action,
      actorUserId: query.actorUserId,
      cursor: query.cursor,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      limit: query.limit,
      targetId: query.targetId,
    });

    return NextResponse.json(auditPage);
  } catch (error) {
    return jsonRouteError(error, "Could not load audit logs.");
  }
}
