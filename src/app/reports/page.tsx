import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Award,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reportStatusTone } from "@/features/reports/lib/approval-rules";
import { ReportsMetricCard } from "@/features/reports/components/reports-metric-card";
import { ReportsSection } from "@/features/reports/components/reports-section";
import { REPORTS_ROUTE_TITLES } from "@/features/reports/lib/page-titles";
import { canAccessConclusionsTab } from "@/features/reports/lib/access";
import { getReportsPageData } from "@/features/reports/server/page-data";
import { getCurrentUser } from "@/features/access-control/server/current-user";

export const dynamic = "force-dynamic";

const SUMMARY_PREVIEW_LIMIT = 6;

export default async function ReportsOverviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const canAccessConclusions = canAccessConclusionsTab(user);
  const data = await getReportsPageData(user, {
    includeEvents: false,
    includeRecognition: true,
    includeReports: true,
    includeSummaries: user.isAdmin,
    includeVolunteerCount: user.isAdmin,
    includeVolunteerExports: false,
  });
  const pendingApproval = data.reports.filter((report) => report.status === "SUBMITTED").length;
  const approvedReports = data.reports.filter((report) => report.status === "APPROVED").length;
  const summaryPreview = data.summaries.slice(0, SUMMARY_PREVIEW_LIMIT);
  const hiddenSummaryCount = Math.max(0, data.summaries.length - summaryPreview.length);

  return (
    <ReportsSection
      canAccessConclusions={canAccessConclusions}
      isAdmin={user.isAdmin}
      title={REPORTS_ROUTE_TITLES["/reports"]}
      description={
        user.isAdmin
          ? "Event summaries, conclusion reports, recognition, and volunteer profile exports in one place."
          : "Recognition standings and conclusion reporting for your events."
      }
    >
      {user.isAdmin ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReportsMetricCard
            accent="primary"
            icon={CalendarDays}
            label="Event summaries"
            value={String(data.summaries.length)}
          />
          <ReportsMetricCard
            accent="neutral"
            icon={FileStack}
            label="Conclusion reports"
            value={String(data.reports.length)}
          />
          <ReportsMetricCard
            accent="warning"
            icon={ClipboardCheck}
            label="Awaiting approval"
            value={String(pendingApproval)}
          />
          <ReportsMetricCard
            accent="success"
            icon={UsersRound}
            label="Volunteer profiles"
            value={String(data.volunteerCount)}
          />
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        {user.isAdmin ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  Event summaries
                </CardTitle>
                <CardDescription>
                  Lifecycle and conclusion status across branch events.
                </CardDescription>
              </div>
              {data.summaries.length > 0 ? (
                <Badge tone="neutral">{data.summaries.length} total</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {summaryPreview.length > 0 ? (
                <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-bg-base/60">
                  {summaryPreview.map((summary) => (
                    <li className="px-4 py-3.5" key={summary.eventId}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[14px] font-medium text-text-strong">{summary.eventTitle}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="primary">{summary.status}</Badge>
                          {summary.reportStatus ? (
                            <Badge tone={reportStatusTone(summary.reportStatus)}>
                              {summary.reportStatus}
                            </Badge>
                          ) : (
                            <Badge>No report</Badge>
                          )}
                        </div>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                        {summary.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyPanel
                  description="Summaries appear once events are tracked in the system."
                  title="No event summaries yet"
                />
              )}
              {hiddenSummaryCount > 0 ? (
                <p className="text-[13px] text-text-muted">
                  Showing {summaryPreview.length} of {data.summaries.length} events.
                </p>
              ) : null}
              <Link className={buttonClasses({ variant: "secondary" })} href="/reports/conclusions">
                Manage conclusion reports
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card
          className={user.isAdmin ? undefined : "lg:col-span-2"}
          variant={data.volunteerOfTheMonth ? "highlight" : "default"}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              Recognition snapshot
            </CardTitle>
            <CardDescription>From approved point ledger entries for the current term.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.volunteerOfTheMonth ? (
              <div className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Volunteer of the month
                </p>
                <p className="mt-2 text-[18px] font-semibold text-text-strong">
                  {data.volunteerOfTheMonth.name}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-text-body">
                  {data.volunteerOfTheMonth.highlight}
                </p>
              </div>
            ) : (
              <EmptyPanel
                description="No eligible points have been awarded for the current month."
                icon={Award}
                title="Volunteer of the month pending"
              />
            )}
            {data.hallOfFame[0] ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Hall of fame leader
                  </p>
                  <p className="mt-1 text-[14px] font-medium text-text-strong">
                    {data.hallOfFame[0].name}
                  </p>
                </div>
                <Badge tone="success">{data.hallOfFame[0].pointsEarned} pts</Badge>
              </div>
            ) : (
              <p className="text-[13px] text-text-muted">
                No eligible points have been awarded for the current IEEE term.
              </p>
            )}
            <Link className={buttonClasses({ variant: "secondary" })} href="/reports/recognition">
              View recognition
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>

      {user.isAdmin || canAccessConclusions ? (
        <section className="grid gap-4 md:grid-cols-2">
          {canAccessConclusions ? (
            <QuickLinkCard
              description={
                user.isAdmin
                  ? `${pendingApproval} awaiting approval · ${approvedReports} approved`
                  : "Create and submit structured conclusion reports for your events."
              }
              href="/reports/conclusions"
              icon={ClipboardList}
              title="Conclusion reports"
            />
          ) : null}
          {user.isAdmin ? (
            <QuickLinkCard
              description="Export identity, roles, participation, recommendations, and points as PDF."
              href="/reports/volunteers"
              icon={UsersRound}
              title="Volunteer exports"
            />
          ) : null}
        </section>
      ) : null}
    </ReportsSection>
  );
}

function EmptyPanel({
  description,
  icon: Icon = CalendarDays,
  title,
}: {
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border-subtle bg-bg-base/40 px-6 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-text-strong">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

function QuickLinkCard({
  description,
  href,
  icon: Icon,
  title,
}: {
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Link className="group block cursor-pointer" href={href}>
      <Card className="h-full transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-px group-hover:border-border-default group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
            Open section
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
