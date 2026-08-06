import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportActions } from "@/features/reports/components/export-actions";
import { ReportsSection } from "@/features/reports/components/reports-section";
import { REPORTS_ROUTE_TITLES } from "@/features/reports/lib/page-titles";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function VolunteersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (!user.isAdmin) {
    redirect("/reports/recognition");
  }

  const data = await getReportsPageData(user, {
    includeEvents: false,
    includeRecognition: false,
    includeReports: false,
    includeSummaries: false,
    includeVolunteerCount: false,
    includeVolunteerExports: true,
  });

  return (
    <ReportsSection
      canAccessConclusions={canAccessConclusionsTab(user)}
      isAdmin={user.isAdmin}
      title={REPORTS_ROUTE_TITLES["/reports/volunteers"]}
      description="Export volunteer summaries as formal PDFs from profile, participation, recommendations, and points data."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-4 text-primary" aria-hidden="true" />
            Volunteer profiles
          </CardTitle>
          <CardDescription>
            Identity, roles, participation, recommendations, and approved point totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="min-w-[980px] w-full text-left text-[13px]">
              <thead className="border-b border-border-subtle bg-bg-base">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Volunteer
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    SB roles
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Participation
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Recommendations
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Points
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Export
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-raised">
                {data.volunteers.map((volunteer) => (
                  <tr className="transition-colors hover:bg-primary-soft/40" key={volunteer.userId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-strong">{volunteer.name}</p>
                      <p className="mt-0.5 text-[12px] text-text-muted">{volunteer.uomEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {volunteer.sbRoles.length > 0 ? (
                          volunteer.sbRoles.map((role) => (
                            <Badge key={role} tone="primary">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge>None</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-body">
                      {volunteer.participations.length} event
                      {volunteer.participations.length === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3 text-text-body">{volunteer.recommendations.length}</td>
                    <td className="px-4 py-3">
                      <Badge tone="success">{volunteer.pointsLedger?.total ?? 0}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ExportActions kind="volunteer" userId={volunteer.userId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </ReportsSection>
  );
}
