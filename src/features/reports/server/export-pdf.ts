"use server";

import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { requireAuth } from "@/features/access-control/server/current-user";
import { canExportVolunteerProfilePdf } from "@/features/reports/lib/access";
import { getVolunteerProfile } from "@/features/reports/server/volunteer-profile";
import { buildVolunteerProfilePdf } from "@/pdf";

async function assertVolunteerProfileExportable(userId: string) {
  const profile = await getVolunteerProfile(userId);

  if (!profile) {
    throw new Error("Volunteer profile was not found.");
  }

  return profile;
}

export async function exportVolunteerProfilePdfAction(userId: string) {
  const user = await requireAuth();
  const profile = await assertVolunteerProfileExportable(userId);

  if (!canExportVolunteerProfilePdf(user, userId)) {
    throw new Error("You do not have access to export this volunteer profile.");
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

  return {
    data: result.buffer.toString("base64"),
    filename: result.filename,
  };
}
