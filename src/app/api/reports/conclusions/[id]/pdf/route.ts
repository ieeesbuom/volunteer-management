import {
  requireAuth,
} from "@/features/access-control/server/current-user";
import {
  assertConclusionReportExportable,
  canExportConclusionReportPdf,
} from "@/features/reports/server/conclusion-service";
import { buildConclusionReportPdf } from "@/pdf";
import { jsonError, routeErrorStatus } from "@/server/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const { approval, report } = await assertConclusionReportExportable(id);

    if (!canExportConclusionReportPdf(user, report)) {
      return jsonError("You do not have access to export this report.", 403);
    }

    const result = await buildConclusionReportPdf({
      approvedAt: formatPdfDate(approval.reviewedAt),
      content: report.content,
      eventId: report.eventId,
      eventTitle: report.eventTitle,
      submittedAt: formatPdfDate(report.submittedAt),
      submittedByName: report.submittedByName,
    });

    return pdfResponse(result.buffer, result.filename);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Conclusion report PDF export failed.",
      routeErrorStatus(error),
    );
  }
}

function formatPdfDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function pdfResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}
