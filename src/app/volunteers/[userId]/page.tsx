import { MessageSquareQuote, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { AppPage } from "@/components/layout/app-page";
import { AppPageNavProvider } from "@/components/layout/app-page-nav-context";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { getVolunteerProfileSummary } from "@/features/volunteers/server/profiles";
import { CopyProfileLinkButton } from "@/features/volunteers/components/copy-profile-link-button";
import { listVisibleRecommendationsForVolunteer } from "@/features/recommendations/server/recommendations";
import { RecommendationList } from "@/features/recommendations/components/recommendation-list";
import { RecommendationRequestForm } from "@/features/recommendations/components/recommendation-request-form";

export const dynamic = "force-dynamic";

export default async function VolunteerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const user = await getCurrentUser();

  const { userId } = await params;
  const profile = await getVolunteerProfileSummary(userId, { viewer: user });

  if (!profile) {
    if (!user) {
      return (
        <PublicVolunteerLayout>
          <PageHeader
            showTitle
            title="Volunteer Not Found"
            description="No active verified volunteer profile exists for this account."
          />
        </PublicVolunteerLayout>
      );
    }

    return (
      <AppShell active="profile" user={user}>
        <PageHeader
          title="Volunteer Not Found"
          description="No active verified volunteer profile exists for this account."
        />
      </AppShell>
    );
  }
  const viewerCanVolunteer = user ? canVolunteer(user.profile) : false;
  const canRequestRecommendation =
    viewerCanVolunteer && user?.authUser.id !== profile.userId;
  const canReportRecommendations = viewerCanVolunteer;
  const profileDisplayName = profile.name || "Verified volunteer";
  const recommendations = profile.isPrivateView
    ? await listVisibleRecommendationsForVolunteer(userId)
    : [];
  const content = (
    <VolunteerProfileContent
      canReportRecommendations={canReportRecommendations}
      canRequestRecommendation={canRequestRecommendation}
      profile={profile}
      profileDisplayName={profileDisplayName}
      recommendations={recommendations}
      showTitle={!user}
      userIsUnverified={Boolean(user && !viewerCanVolunteer)}
    />
  );

  if (!user) {
    return <PublicVolunteerLayout>{content}</PublicVolunteerLayout>;
  }

  return (
    <AppShell active="directory" user={user}>
      {content}
    </AppShell>
  );
}

function VolunteerProfileContent({
  canReportRecommendations,
  canRequestRecommendation,
  profile,
  profileDisplayName,
  recommendations,
  showTitle = false,
  userIsUnverified,
}: {
  canReportRecommendations: boolean;
  canRequestRecommendation: boolean;
  profile: NonNullable<Awaited<ReturnType<typeof getVolunteerProfileSummary>>>;
  profileDisplayName: string;
  recommendations: Awaited<ReturnType<typeof listVisibleRecommendationsForVolunteer>>;
  showTitle?: boolean;
  userIsUnverified: boolean;
}) {
  const recommendationCount = profile.isPrivateView ? recommendations.length : null;
  const profilePath = `/volunteers/${profile.userId}`;

  return (
    <AppPage>
      <PageHeader
        showTitle={showTitle}
        title={profileDisplayName}
        description={profile.details?.headline ?? "Volunteer profile"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Verified volunteer</Badge>
            <CopyProfileLinkButton path={profilePath} />
          </div>
        }
      />

      {/* Public-first: About + Event contributions */}
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" aria-hidden="true" />
              About
            </CardTitle>
            <CardDescription>Public profile highlights and useful volunteer links.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-text-secondary">
            <p>{profile.details?.bio ?? "No volunteer bio has been added yet."}</p>
            <InfoRow label="Skills" value={profile.details?.skills ?? "Not provided"} />
            <InfoRow label="LinkedIn" value={profile.details?.linkedinUrl ?? "Not provided"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event contributions</CardTitle>
            <CardDescription>
              Events this volunteer has contributed to through assigned roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-secondary">
            {profile.eventRoles.length > 0 ? (
              profile.eventRoles.map((role) => (
                <div
                  className="rounded-md border border-border p-3"
                  key={`${role.eventId}-${role.role}-${role.committeeName ?? ""}`}
                >
                  <p className="font-medium text-text-primary">{role.eventTitle}</p>
                  <p>{[role.role, role.committeeName].filter(Boolean).join(" · ")}</p>
                </div>
              ))
            ) : (
              <p>No event responsibilities assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Private-only identity, SB roles, and recommendations */}
      {profile.isPrivateView ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>Account and academic identifiers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Google email" value={profile.googleEmail ?? "Hidden"} />
                <InfoRow label="UoM email" value={profile.uomEmail ?? "Hidden"} />
                <InfoRow
                  label="University index"
                  value={profile.details?.universityIndex ?? "Not provided"}
                />
                <InfoRow label="Faculty" value={profile.details?.faculty ?? "Not provided"} />
                <InfoRow label="Department" value={profile.details?.department ?? "Not provided"} />
                <InfoRow label="Batch / Year" value={profile.details?.batchYear ?? "Not provided"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SB roles</CardTitle>
                <CardDescription>Active student branch role assignments.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.sbRoles.length > 0 ? (
                    profile.sbRoles.map((role) => <Badge key={role}>{role}</Badge>)
                  ) : (
                    <Badge>No SB roles</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquareQuote className="size-4 text-primary" aria-hidden="true" />
                    Recommendations
                    {recommendationCount !== null && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        {recommendationCount}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Written endorsements from fellow verified volunteers.
                  </CardDescription>
                </div>

                {canRequestRecommendation ? (
                  <RecommendationRequestForm
                    respondentId={profile.userId}
                    respondentName={profileDisplayName}
                  />
                ) : null}
              </div>

              {userIsUnverified ? (
                <p className="mt-2 text-sm text-text-muted">
                  Verify your UoM email before requesting or reporting recommendations.
                </p>
              ) : null}
            </CardHeader>

            <CardContent>
              <RecommendationList
                canReport={canReportRecommendations}
                initialRecommendations={recommendations}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareQuote className="size-4 text-primary" aria-hidden="true" />
                  Recommendations
                </CardTitle>
                <CardDescription className="mt-1">
                  Written endorsements from fellow verified volunteers.
                </CardDescription>
              </div>

              {canRequestRecommendation ? (
                <RecommendationRequestForm
                  respondentId={profile.userId}
                  respondentName={profileDisplayName}
                />
              ) : null}
            </div>

            {userIsUnverified ? (
              <p className="mt-2 text-sm text-text-muted">
                Verify your UoM email before requesting or reporting recommendations.
              </p>
            ) : null}
          </CardHeader>

          <CardContent>
            <p className="text-sm text-text-secondary">
              Recommendations are visible only to the profile owner and admins.
            </p>
          </CardContent>
        </Card>
      )}
    </AppPage>
  );
}

function PublicVolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppPageNavProvider defaultTitle="Volunteer Profile">
      <main className="min-h-screen bg-background text-text-primary">
        <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
          {children}
        </div>
      </main>
    </AppPageNavProvider>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="wrap-break-word text-text-primary">{value}</span>
    </div>
  );
}
