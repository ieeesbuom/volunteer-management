import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Eye, MailCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportActions } from "@/features/reports/components/export-actions";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { canVolunteer } from "@/features/access-control/lib/rules";
import { VerificationPanel } from "@/features/access-control/components/verification-panel";
import { getVolunteerProfileDetails } from "@/features/volunteers/server/profiles";
import { ProfileDetailsForm } from "@/features/volunteers/components/profile-details-form";
import { RecommendationRequestsPanel } from "@/features/recommendations/components/recommendation-requests-panel";
import { listRecommendationRequestsForVolunteer } from "@/features/recommendations/server/recommendations";

export const dynamic = "force-dynamic";

export default async function MyVolunteerProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const canManageVolunteerProfile = canVolunteer(user.profile);
  const details = canManageVolunteerProfile
    ? await getVolunteerProfileDetails(user.authUser.id)
    : null;
  const recommendationRequests = canManageVolunteerProfile
    ? await listRecommendationRequestsForVolunteer(user.authUser.id)
    : { incoming: [], outgoing: [] };

  return (
    <AppShell active="volunteers" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Volunteer Profile"
          description="Manage your verification, public profile details, and recommendation requests."
          actions={
            canManageVolunteerProfile ? (
              <div className="flex items-center gap-2">
                <ExportActions kind="volunteer" userId={user.authUser.id} />
                <Link className={buttonClasses()} href={`/volunteers/${user.authUser.id}`}>
                  <Eye className="size-4" aria-hidden="true" />
                  View Profile
                </Link>
              </div>
            ) : null
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-primary" aria-hidden="true" />
              UoM Verification
            </CardTitle>
            <CardDescription>
              University verification is required before volunteering and profile publishing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.profile.uomVerified ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-success/20 bg-success-soft text-success">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-text-primary">
                      University email verified
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {user.profile.uomEmail}
                    </p>
                  </div>
                </div>
                <Badge tone="success">Verified</Badge>
              </div>
            ) : (
              <VerificationPanel />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              These fields are separate from your Appwrite login identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageVolunteerProfile ? (
              <ProfileDetailsForm initialDetails={details} />
            ) : (
              <div className="space-y-3">
                <Badge tone="warning">UoM verification required</Badge>
                <p className="text-sm text-text-secondary">
                  Verify your UoM email before creating volunteer profile details.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendation Requests</CardTitle>
            <CardDescription>
              Track pending requests and write recommendations for other verified volunteers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManageVolunteerProfile ? (
              <RecommendationRequestsPanel initialRequests={recommendationRequests} />
            ) : (
              <p className="text-sm text-text-secondary">
                Verify your UoM email before requesting or writing recommendations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
