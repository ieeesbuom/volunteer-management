import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { requireAuth } from "@/features/access-control/server/current-user";
import { canExportVolunteerProfilePdf } from "@/features/reports/lib/access";
import { getVolunteerProfile } from "@/features/reports/server/volunteer-profile";
import { buildVolunteerProfilePdf } from "@/pdf";
import { jsonError, routeErrorStatus , routeErrorMessage} from "@/server/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { userId } = await context.params;

    if (!canExportVolunteerProfilePdf(user, userId)) {
      return jsonError("You do not have access to export volunteer profiles.", 403);
    }

    const profile = await getVolunteerProfile(userId);

    if (!profile) {
      return jsonError("Volunteer profile was not found.", 404);
    }

    const result = await buildVolunteerProfilePdf({
      googleEmail: profile.googleEmail,
      name: profile.name,
      participations: profile.participations.map((participation) => ({
        assignedAt: participation.assignedAt,
        committeeName: participation.committeeName,
        eventTitle: participation.eventTitle,
        role: getEventRoleDisplayName(participation.role),
      })),
      pointsLedger: profile.pointsLedger
        ? {
            entries: profile.pointsLedger.entries.map((entry) => ({
              awardedAt: entry.awardedAt,
              eventTitle: entry.eventTitle,
              points: entry.points,
              role: getEventRoleDisplayName(entry.role),
            })),
            total: profile.pointsLedger.total,
          }
        : undefined,
      recommendations: profile.recommendations,
      sbRoles: profile.sbRoles,
      uomEmail: profile.uomEmail,
    });

    return pdfResponse(result.buffer, result.filename);
  } catch (error) {
    return jsonError(
      routeErrorMessage(error, "Volunteer profile PDF export failed."),
      routeErrorStatus(error),
    );
  }
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
