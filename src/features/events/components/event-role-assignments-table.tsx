import Link from "next/link";
import { Trash2, UserRound } from "lucide-react";
import type { EventRoleAssignment } from "@/features/access-control/types";
import { DataTableHead, DataTableShell } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { volunteerInitials } from "@/components/leaderboard/leaderboard-table-ui";
import { formatEventDate } from "@/features/events/lib/event-ui";

type VolunteerIdentity = {
  googleEmail: string;
  name: string;
  uomEmail?: string;
  userId: string;
};

export function EventRoleAssignmentsTable({
  assignments,
  canManageActions,
  formatRole,
  onRemove,
  pendingRemoveId,
  volunteersByUserId,
  canRemoveAssignment,
}: {
  assignments: EventRoleAssignment[];
  canManageActions: boolean;
  formatRole: (assignment: EventRoleAssignment) => string;
  onRemove: (assignment: EventRoleAssignment) => void;
  pendingRemoveId: string | null;
  volunteersByUserId: Map<string, VolunteerIdentity>;
  canRemoveAssignment: (assignment: EventRoleAssignment) => boolean;
}) {
  const columns = canManageActions
    ? [
        { label: "Member" },
        { label: "Role" },
        { label: "Committee" },
        { label: "Assigned" },
        { label: "Actions", align: "right" as const },
      ]
    : [
        { label: "Member" },
        { label: "Role" },
        { label: "Committee" },
        { label: "Assigned" },
      ];

  return (
    <DataTableShell minWidth={640}>
      <colgroup>
        <col />
        <col className="w-[140px]" />
        <col className="w-[140px]" />
        <col className="w-[120px]" />
        {canManageActions ? <col className="w-[100px]" /> : null}
      </colgroup>
      <DataTableHead columns={columns} />
      <tbody>
        {assignments.map((assignment) => {
          const volunteer = volunteersByUserId.get(assignment.userId);
          const displayName = volunteer?.name || "Volunteer";
          const email = volunteer?.uomEmail || volunteer?.googleEmail || "Profile unavailable";
          const canRemove = canManageActions && canRemoveAssignment(assignment);

          return (
            <tr
              key={assignment.$id}
              className="border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-base/60"
            >
              <td className="px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-[11px] font-bold text-text-strong"
                    aria-hidden
                  >
                    {volunteerInitials(displayName)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/volunteers/${assignment.userId}`}
                      className="block truncate text-[13px] font-semibold text-text-strong transition-colors hover:text-primary cursor-pointer"
                    >
                      {displayName}
                    </Link>
                    <p className="truncate text-[12px] text-text-muted">{email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className="inline-flex max-w-full truncate rounded-full border border-border-subtle bg-bg-base px-2.5 py-1 text-[12px] font-medium text-text-body">
                  {formatRole(assignment)}
                </span>
              </td>
              <td className="px-4 py-3.5 text-[13px] text-text-muted">
                {assignment.committeeName || "Event-level"}
              </td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums text-text-muted">
                {formatEventDate(assignment.assignedAt)}
              </td>
              {canManageActions ? (
                <td className="px-4 py-3.5 text-right">
                  {canRemove ? (
                    <Button
                      disabled={pendingRemoveId === assignment.$id}
                      onClick={() => onRemove(assignment)}
                      type="button"
                      variant="ghost"
                      className="h-9 px-2.5 text-[12px] text-text-muted hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  ) : (
                    <span className="text-[12px] text-text-placeholder">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </DataTableShell>
  );
}

export function EventMembersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-bg-base/40 px-6 py-12 text-center">
      <UserRound className="size-8 text-text-placeholder" aria-hidden="true" />
      <p className="text-[13px] font-medium text-text-strong">No members assigned</p>
      <p className="max-w-sm text-[12px] text-text-muted">
        Committee members with active roles will appear here.
      </p>
    </div>
  );
}
