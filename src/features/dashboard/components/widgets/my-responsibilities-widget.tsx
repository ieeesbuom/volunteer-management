"use client";

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";
import { Badge } from "@/components/ui/badge";

export function MyResponsibilitiesWidget() {
  const { user } = useDashboardData();
  const roles = user.eventRoles.filter((role) => role.active);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Briefcase className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="truncate text-[15px] font-semibold text-text-strong">My Responsibilities</h2>
        </div>
        <Link
          href="/events"
          className="shrink-0 text-[12px] font-semibold text-primary hover:underline"
        >
          Events
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {roles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-subtle bg-bg-base/60 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-text-strong">No event assignments yet</p>
            <p className="mt-1 text-[12px] text-text-muted">
              Roles you are assigned to will appear here.
            </p>
            <Link
              href="/events"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              Browse events <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {roles.map((assignment) => (
              <li key={assignment.$id}>
                <Link
                  href={`/events/${assignment.eventId}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-bg-base/50 px-3 py-2.5 transition-colors hover:border-primary-mid hover:bg-primary-soft/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-text-strong">
                      {assignment.eventTitle}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-text-muted">
                      {getEventRoleDisplayName(assignment.role, {
                        chairCount: assignment.eventChairCount ?? 0,
                      })}
                      {assignment.committeeName ? ` · ${assignment.committeeName}` : ""}
                    </p>
                  </div>
                  <Badge tone="neutral" className="shrink-0 text-[10px]">
                    Active
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
