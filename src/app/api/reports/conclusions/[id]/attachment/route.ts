import { NextResponse } from "next/server";
import { requireAuth } from "@/features/access-control/server/current-user";
import { CONCLUSION_REPORT_PDF_MAX_BYTES } from "@/features/reports/lib/conclusion-attachment";
import {
  attachConclusionReportPdf,
  canViewConclusionReport,
  getConclusionReport,
  resolveConclusionReportPdf,
} from "@/features/reports/server/conclusion-service";
import { jsonError, routeErrorMessage, routeErrorStatus, ValidationError } from "@/server/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const report = await getConclusionReport(id);

    if (!report) {
      return jsonError("Conclusion report was not found.", 404);
    }

    if (!canViewConclusionReport(user, report)) {
      return jsonError("You do not have access to this report.", 403);
    }

    const attachment = await resolveConclusionReportPdf(report);

    if (!attachment) {
      return jsonError("No report PDF has been uploaded yet.", 404);
    }

    return new Response(new Uint8Array(attachment.buffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${attachment.filename}"`,
        "Content-Type": attachment.mimeType,
      },
    });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not load conclusion report PDF."),
      routeErrorStatus(error),
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new ValidationError("Upload the report as multipart form data.");
    }

    const formData = await request.formData();
    const file = formData.get("report");

    if (!(file instanceof File)) {
      throw new ValidationError("Choose a PDF report to upload.");
    }

    if (typeof file.size === "number" && file.size > CONCLUSION_REPORT_PDF_MAX_BYTES) {
      throw new ValidationError("Report PDF must be 10 MB or smaller.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const report = await attachConclusionReportPdf(user, id, bytes, file.name);

    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Could not upload conclusion report PDF."),
      routeErrorStatus(error),
    );
  }
}
