"use client";

import { useCallback, useRef, useState } from "react";
import { AppLink } from "@/components/layout/app-link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { EventRoleAssignment } from "@/features/access-control/types";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { PageHeader } from "@/components/layout/page-header";
import { AppPage } from "@/components/layout/app-page";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  alertDangerClasses,
  fieldSelectClasses,
  modalOverlayClasses,
  modalPanelClasses,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CommitteeManagement,
  type CommitteeManagementHandle,
} from "@/features/events/components/CommitteeManagement";
import {
  EventMembersEmptyState,
  EventRoleAssignmentsTable,
} from "@/features/events/components/event-role-assignments-table";
import { EventLifecycleStepper } from "@/features/events/components/event-lifecycle-stepper";
import { AssignRoleModal } from "@/features/events/components/AssignRoleModal";
import { EventFormConnections } from "@/features/forms/components/event-form-connections";
import { canRemoveCommitteeRole } from "@/features/events/lib/committee-permissions";
import { canViewEventLifecycle } from "@/features/events/lib/event-permissions";
import {
  isGeneralCommittee,
  sortCommitteesGeneralFirst,
} from "@/features/events/lib/general-committee";
import {
  formatConclusionStatus,
  formatEventDate,
  formatEventStatus,
  getAvailableStatusTransitions,
  getConclusionStatusBadgeTone,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";
import type { Committee, CommitteeMember, Event, EventPermissions, EventRole, EventStatus } from "@/features/events/types";
import type { FormConnection } from "@/features/forms/types";
import { EVENT_STATUSES } from "@/features/events/types";
import { cn } from "@/lib/utils";

const LIFECYCLE_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  published: "Published",
  ongoing: "Ongoing",
  pending_conclusion: "Pending Conclusion",
  closed: "Closed",
};

function formatAssignmentRole(assignment: EventRoleAssignment) {
  return getEventRoleDisplayName(assignment.role, {
    chairCount: assignment.eventChairCount ?? 0,
  });
}

export type EventVolunteerIdentity = {
  googleEmail: string;
  name: string;
  uomEmail?: string;
  userId: string;
};

export function EventDetail({
  canManageFormConnections,
  currentUserId,
  initialAssignments,
  initialCommittees,
  initialEvent,
  initialFormConnections,
  initialPermissions,
  initialVolunteers,
  isAdmin,
  isVolunteer = false,
  userEventRole,
} : Readonly<{
  canManageFormConnections: boolean;
  currentUserId: string;
  initialAssignments: EventRoleAssignment[];
  initialCommittees: Array<Committee & { members: CommitteeMember[] }>;
  initialEvent: Event;
  initialFormConnections: FormConnection[];
  initialPermissions: EventPermissions;
  initialVolunteers: EventVolunteerIdentity[];
  isAdmin: boolean;
  isVolunteer?: boolean;
  userEventRole: EventRole | null;
}>) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [committees, setCommittees] = useState(initialCommittees);
  const [permissions] = useState(initialPermissions);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const committeeRef = useRef<CommitteeManagementHandle>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<EventStatus | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | "">("");
  const [removeTarget, setRemoveTarget] = useState<EventRoleAssignment | null>(null);

  const refreshAssignments = useCallback(async () => {
    const response = await fetch(`/api/events/${event.$id}/roles`);
    const payload = await response.json();

    if (response.ok) {
      setAssignments(payload.assignments ?? []);
    }
  }, [event.$id]);

  async function handleStatusChange(toStatus: EventStatus) {
    setPendingAction("status");
    setError("");
    setMessage("Updating event status...");

    try {
      const response = await fetch(`/api/events/${event.$id}/status`, {
        body: JSON.stringify({ status: toStatus }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not update event status.");
        setMessage("");
        return;
      }

      setEvent(payload.event);
      setMessage("Event status updated.");
      setSelectedStatus("");
      router.refresh();
    } catch {
      setError("Could not update event status.");
      setMessage("");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    setPendingAction("delete");
    setError("");

    try {
      const response = await fetch(`/api/events/${event.$id}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not delete event.");
        return;
      }

      setShowDeleteConfirm(false);
      router.push("/events");
      router.refresh();
    } catch {
      setError("Could not delete event.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveMember(assignment: EventRoleAssignment) {
    setPendingAction(assignment.$id);
    setError("");

    try {
      const response = await fetch(
        `/api/events/${event.$id}/roles/${assignment.$id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error ?? "Could not remove committee member.");
        return;
      }

      await refreshAssignments();
      setMessage("Committee member removed.");
      setRemoveTarget(null);
    } catch {
      setError("Could not remove committee member.");
    } finally {
      setPendingAction(null);
    }
  }

  const statusTransitions = getAvailableStatusTransitions(event.status, { isAdmin });
  const volunteersByUserId = new Map(
    initialVolunteers.map((volunteer) => [volunteer.userId, volunteer]),
  );
  const isPrivileged = isAdmin || userEventRole === "Chair";
  const canViewLifecycle = canViewEventLifecycle(
    isAdmin,
    event.$id,
    userEventRole
      ? [{ active: true, eventId: event.$id, role: userEventRole }]
      : [],
  );
  const canChangeStatus =
    (isAdmin || userEventRole === "Chair") && statusTransitions.length > 0;
  const currentStatusIndex = EVENT_STATUSES.indexOf(event.status);
  const canOpenConclusionReport =
    permissions.canSubmitConclusion &&
    event.status === "ongoing" &&
    (event.conclusion_status === "not_submitted" || event.conclusion_status === "rejected");
  const canReviewConclusionReport =
    permissions.canApproveConclusion && event.conclusion_status === "submitted";

  return (
    <AppPage>
      <PageHeader
        title={event.title}
        description={
          isPrivileged
            ? `${event.reference} · ${event.term} · ${event.year}`
            : `${event.term} · ${event.year}`
        }
        actions={
          <AppLink className={buttonClasses()} href="/events">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Events
          </AppLink>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {canViewLifecycle ? (
              <div className="flex flex-wrap gap-2">
                <Badge tone={getEventStatusBadgeTone(event.status)}>
                  {formatEventStatus(event.status)}
                </Badge>
                <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
                  {formatConclusionStatus(event.conclusion_status)}
                </Badge>
              </div>
            ) : null}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-body">Start date</dt>
                <dd className="font-medium text-text-strong">
                  {formatEventDate(event.start_date)}
                </dd>
              </div>
              <div>
                <dt className="text-text-body">End date</dt>
                <dd className="font-medium text-text-strong">
                  {event.end_date ? formatEventDate(event.end_date) : "Not set"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {permissions.canEdit ? (
              <AppLink className={buttonClasses()} href={`/events/${event.$id}/edit`}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </AppLink>
            ) : null}
            {permissions.canDelete ? (
              <Button onClick={() => setShowDeleteConfirm(true)} type="button" variant="ghost">
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className={alertDangerClasses}>
          {error}
        </p>
      ) : null}

      {canChangeStatus ? (
        <Card>
          <CardHeader>
            <CardTitle>Change Status</CardTitle>
            <CardDescription>
              Advance or adjust the event lifecycle according to your permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1 text-[13px] font-semibold text-text-body mb-1.5">
              New status
              <select
                className={cn(fieldSelectClasses, "mt-1 font-normal")}
                onChange={(changeEvent) =>
                  setSelectedStatus(changeEvent.target.value as EventStatus)
                }
                value={selectedStatus}
              >
                <option value="">Select status</option>
                {statusTransitions.map((status) => (
                  <option key={status} value={status}>
                    {formatEventStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!selectedStatus || pendingAction === "status"}
              onClick={() => selectedStatus && setPendingStatusChange(selectedStatus as EventStatus)}
              type="button"
              variant="primary"
              className="cursor-pointer"
            >
              {pendingAction === "status" ? "Updating..." : "Update Status"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-text-body">
            {event.description?.trim() ? event.description : "No description provided."}
          </p>
        </CardContent>
      </Card>

      {isPrivileged ? (
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>Event progression from draft through closure.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <EventLifecycleStepper
              currentIndex={currentStatusIndex}
              labels={LIFECYCLE_LABELS}
              statuses={EVENT_STATUSES}
            />
          </CardContent>
        </Card>
      ) : null}

      <CommitteeManagement
        ref={committeeRef}
        canManage={permissions.canManageCommittee}
        eventId={event.$id}
        initialCommittees={initialCommittees}
        volunteerOptions={initialVolunteers}
        onCommitteesChange={setCommittees}
      />

      <EventFormConnections
        assignments={assignments}
        canManage={canManageFormConnections}
        committees={committees}
        currentUserId={currentUserId}
        eventId={event.$id}
        initialConnections={initialFormConnections}
        isVolunteer={isVolunteer}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-text-muted" aria-hidden="true" />
                Members & roles
              </CardTitle>
              <CardDescription>Active role assignments for this event.</CardDescription>
            </div>
            {permissions.canAssignRoles ? (
              <Button onClick={() => setShowAssignModal(true)} type="button" variant="primary">
                <UserPlus className="size-4" aria-hidden="true" />
                Add member
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {assignments.length > 0 ? (
            <EventRoleAssignmentsTable
              assignments={assignments}
              canManageActions={permissions.canAssignRoles}
              canRemoveAssignment={(assignment) =>
                canRemoveCommitteeRole({
                  actorEventRole: userEventRole,
                  actorUserId: currentUserId,
                  isAdmin,
                  targetAssignment: assignment,
                })
              }
              formatRole={formatAssignmentRole}
              onRemove={setRemoveTarget}
              pendingRemoveId={pendingAction}
              volunteersByUserId={volunteersByUserId}
            />
          ) : (
            <EventMembersEmptyState />
          )}
        </CardContent>
      </Card>

      {isPrivileged ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-primary" aria-hidden="true" />
              Conclusion Status
            </CardTitle>
            <CardDescription>Post-event conclusion workflow state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge tone={getConclusionStatusBadgeTone(event.conclusion_status)}>
              {formatConclusionStatus(event.conclusion_status)}
            </Badge>

            <div className="flex flex-wrap gap-2">
              {canOpenConclusionReport ? (
                <AppLink
                  className={buttonClasses({ variant: "primary" })}
                  href={`/reports/conclusions?eventId=${event.$id}`}
                >
                  Open Report Form
                </AppLink>
              ) : null}

              {canReviewConclusionReport ? (
                <AppLink className={buttonClasses()} href="/reports/conclusions">
                  Review Report
                </AppLink>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {message ? <p className="text-sm text-text-body">{message}</p> : null}

      {showAssignModal ? (() => {
        const generalCommittee = committees.find((committee) => isGeneralCommittee(committee.name));
        const generalMemberUserIds = new Set(
          generalCommittee?.members.map((member) => member.user_id) ?? [],
        );
        const volunteerOptions = [...initialVolunteers].sort((left, right) => {
          const leftOnGeneral = generalMemberUserIds.has(left.userId);
          const rightOnGeneral = generalMemberUserIds.has(right.userId);

          if (leftOnGeneral !== rightOnGeneral) {
            return leftOnGeneral ? -1 : 1;
          }

          return (left.name || left.googleEmail).localeCompare(right.name || right.googleEmail);
        });

        return (
          <AssignRoleModal
            committeeNames={sortCommitteesGeneralFirst(committees).map(
              (committee) => committee.name,
            )}
            currentUserIsAdmin={isAdmin}
            eventId={event.$id}
            onClose={() => setShowAssignModal(false)}
            onSuccess={() => {
              void refreshAssignments();
              void committeeRef.current?.refresh();
            }}
            volunteerOptions={volunteerOptions}
          />
        );
      })() : null}

      {showDeleteConfirm ? (
        <ConfirmationDialog
          confirmLabel="Delete Event"
          description="This action permanently removes the event record."
          isBusy={pendingAction === "delete"}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Event"
        />
      ) : null}

      {removeTarget ? (
        <ConfirmationDialog
          confirmLabel="Remove Member"
          description={`Remove ${formatAssignmentRole(removeTarget)} from this event committee?`}
          isBusy={pendingAction === removeTarget.$id}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => handleRemoveMember(removeTarget)}
          title="Remove Committee Member"
        />
      ) : null}

      {pendingStatusChange ? (() => {
        const isRevert = EVENT_STATUSES.indexOf(pendingStatusChange) < EVENT_STATUSES.indexOf(event.status);
        return (
          <ConfirmationDialog
            confirmLabel={isRevert ? "Yes, Revert Status" : "Yes, Update Status"}
            description={
              isRevert
                ? `This will revert the event back from "${formatEventStatus(event.status)}" to "${formatEventStatus(pendingStatusChange)}". This is a backward change — are you sure?`
                : `This will advance the event from "${formatEventStatus(event.status)}" to "${formatEventStatus(pendingStatusChange)}". This action will notify all registered volunteers.`
            }
            isBusy={pendingAction === "status"}
            onCancel={() => setPendingStatusChange(null)}
            onConfirm={async () => {
              await handleStatusChange(pendingStatusChange);
              setPendingStatusChange(null);
            }}
            title={isRevert ? `Revert to "${formatEventStatus(pendingStatusChange)}"?` : `Change to "${formatEventStatus(pendingStatusChange)}"?`}
          />
        );
      })() : null}
    </AppPage>
  );
}

function ConfirmationDialog({
  confirmLabel,
  description,
  isBusy,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div
      aria-modal="true"
      className={modalOverlayClasses}
      role="dialog"
    >
      <div className={modalPanelClasses}>
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold text-text-strong">{title}</h3>
              <p className="mt-1 text-[14px] leading-6 text-text-body">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border-subtle bg-bg-base/50 px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
            {isBusy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
