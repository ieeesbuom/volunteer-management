import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  MailCheck,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
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
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { listEventsByIds } from "@/features/events/server/event-service";
import { createAppwriteFormConnectionRepository } from "@/features/forms/server/form-connection-repository";
import { isEligibleForGlobalDashboard } from "@/features/forms/lib/audience";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const formRepo = createAppwriteFormConnectionRepository();
  const allConnections = await formRepo.list({ limit: 100 });
  const activeRegistrations = allConnections.filter(isEligibleForGlobalDashboard);

  const assignedEventIds = new Set(user.eventRoles.map((r) => r.eventId));
  const openOpportunities = activeRegistrations.filter(
    (conn) => !assignedEventIds.has(conn.eventId)
  );

  const opportunityEvents = openOpportunities.length > 0
    ? await listEventsByIds(openOpportunities.map((o) => o.eventId))
    : [];

  const eventsMap = new Map(opportunityEvents.map((e) => [e.$id, e]));
  const allowedStatuses = ["planning", "published", "ongoing"];
  const opportunityList = openOpportunities
    .map((conn) => ({ conn, event: eventsMap.get(conn.eventId) }))
    .filter(({ event }) => {
      if (!event) return false;
      if (!allowedStatuses.includes(event.status)) return false;
      if (event.reference && assignedEventIds.has(event.reference)) return false;
      return true;
    });

  return (
    <AppShell active="dashboard" user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Your profile, access, responsibilities, and notification preferences."
          actions={
            <>
              <Link
                className={buttonClasses({
                  variant: user.profile.uomVerified ? "secondary" : "primary",
                })}
                href="/volunteers/me"
              >
                <MailCheck className="size-4" aria-hidden="true" />
                {user.profile.uomVerified ? "Open Profile" : "Verify in Profile"}
              </Link>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-primary" aria-hidden="true" />
                Profile
              </CardTitle>
              <CardDescription>Account identity and UoM verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={user.profile.uomVerified ? "success" : "warning"}>
                  {user.profile.uomVerified ? "UoM verified" : "UoM verification required"}
                </Badge>
                <Badge tone={user.profile.status === "ACTIVE" ? "success" : "warning"}>
                  {user.profile.status}
                </Badge>
              </div>
              <InfoRow label="Name" value={user.authUser.name || "Not provided"} />
              <InfoRow label="Google email" value={user.authUser.email} />
              <InfoRow
                label="UoM email"
                value={user.profile.uomEmail ?? "Not verified yet"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Access
              </CardTitle>
              <CardDescription>Branch and admin privileges assigned to this account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone={user.isAdmin ? "success" : "neutral"}>
                  {user.isAdmin ? "Admin" : "Volunteer access"}
                </Badge>
                <Badge tone={user.eventRoles.length > 0 ? "primary" : "neutral"}>
                  {user.eventRoles.length} event role{user.eventRoles.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">SB roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.sbRoles.length > 0 ? (
                    user.sbRoles.map((role) => (
                      <Badge key={role} tone="primary">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge>No assigned SB roles</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {opportunityList.length > 0 && (
          <Card className="border-primary/20 bg-gradient-to-br from-surface to-primary-soft/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary font-bold">
                <UsersRound className="size-5 text-primary" aria-hidden="true" />
                Open Volunteer Opportunities
              </CardTitle>
              <CardDescription>
                New events looking for volunteers. Register to join the team!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {opportunityList.map(({ conn, event }) => (
                  <div
                    key={conn.id}
                    className="flex flex-col justify-between p-4 rounded-lg border border-border bg-surface hover:border-primary/30 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-text-primary text-base">
                          {event?.title}
                        </h4>
                        <Badge tone="success" className="shrink-0">
                          Registration Open
                        </Badge>
                      </div>
                      <p className="text-sm text-text-secondary line-clamp-2">
                        {event?.description || "Join as a volunteer to help organize this event."}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-text-muted mt-2">
                        <span>Term: {event?.term}</span>
                        <span>•</span>
                        <span>Year: {event?.year}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        Form: {conn.title}
                      </span>
                      <a
                        href={conn.formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClasses({
                          variant: "primary",
                          className: "cursor-pointer h-9 px-4 text-xs font-semibold",
                        })}
                      >
                        Register to Volunteer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              Event Responsibilities
            </CardTitle>
            <CardDescription>
              Active event-scoped roles assigned by the Admin account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.eventRoles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] divide-y divide-border text-left text-sm">
                  <thead className="text-text-secondary">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold">Role</th>
                      <th className="px-4 py-2 font-semibold">Committee</th>
                      <th className="px-4 py-2 font-semibold">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {user.eventRoles.map((assignment) => (
                      <tr key={assignment.$id}>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/events/${assignment.eventId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {assignment.eventTitle}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="primary">
                            {getEventRoleDisplayName(assignment.role, {
                              chairCount: assignment.eventChairCount ?? 0,
                            })}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {assignment.committeeName ?? "Event-level"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No event responsibilities are currently assigned to this account.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-text-secondary">{label}</span>
      <span className="break-all text-text-primary">{value}</span>
    </div>
  );
}
