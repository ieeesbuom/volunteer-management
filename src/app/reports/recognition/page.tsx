import { Award, Trophy } from "lucide-react";
import { HallOfFameTable } from "@/features/reports/components/hall-of-fame-table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportsSection } from "@/features/reports/components/reports-section";
import { REPORTS_ROUTE_TITLES } from "@/features/reports/lib/page-titles";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

export default async function RecognitionPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const data = await getReportsPageData(user, {
    includeEvents: false,
    includeRecognition: true,
    includeReports: false,
    includeSummaries: false,
    includeVolunteerCount: false,
    includeVolunteerExports: false,
  });

  return (
    <ReportsSection
      canAccessConclusions={canAccessConclusionsTab(user)}
      isAdmin={user.isAdmin}
      title={REPORTS_ROUTE_TITLES["/reports/recognition"]}
      description="Volunteer of the Month and Hall of Fame rankings from approved point ledger data."
    >
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-4 text-primary" aria-hidden="true" />
              Volunteer of the Month
            </CardTitle>
            <CardDescription>Current month based on approved conclusion dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.volunteerOfTheMonth ? (
              <>
                <p className="text-xl font-semibold text-text-primary">
                  {data.volunteerOfTheMonth.name}
                </p>
                <p className="text-text-secondary">{data.volunteerOfTheMonth.highlight}</p>
                <Badge tone="success">{data.volunteerOfTheMonth.pointsEarned} points earned</Badge>
              </>
            ) : (
              <p className="text-text-secondary">
                No eligible points have been awarded for the current month.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              Term Hall of Fame
            </CardTitle>
            <CardDescription>Current IEEE term ranking with Top Board exclusions</CardDescription>
          </CardHeader>
          <CardContent>
            {data.hallOfFame.length > 0 ? (
              <HallOfFameTable
                entries={data.hallOfFame.map((entry) => ({
                  rank: entry.rank,
                  userId: entry.userId,
                  name: entry.name,
                  pointsEarned: entry.pointsEarned,
                  termLabel: entry.term.label,
                }))}
              />
            ) : (
              <p className="text-sm text-text-secondary">
                No eligible points have been awarded for the current IEEE term.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </ReportsSection>
  );
}
