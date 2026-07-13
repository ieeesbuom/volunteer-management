"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  RefreshCw,
  Search,
  ShieldMinus,
  ShieldPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IEEE_TERMS, SB_ROLES } from "@/lib/config";
import { cn } from "@/lib/utils";
import type {
  EventRoleAssignment,
  Profile,
  RoleAssignment,
  SbRole,
} from "@/features/access-control/types";

type AdminUser = Profile & {
  eventRoles: EventRoleAssignment[];
  sbRoles: SbRole[];
  sbRoleAssignments: RoleAssignment[];
};


type Confirmation = {
  kind: "sb-role";
  role: SbRole;
  userId: string;
  userName: string;
  variant: "assign" | "revoke";
};

type NoticeStatus = "error" | "idle" | "success";

const inputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export function AccessControlPanel({
  initialUsers,
}: {
  initialUsers: AdminUser[];
}) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<NoticeStatus>("idle");
  const [users, setUsers] = useState(initialUsers);
  const [selectedTerm, setSelectedTerm] = useState<string>(IEEE_TERMS[0]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.googleEmail,
        user.uomEmail,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const verifiedCount = users.filter((user) => user.uomVerified).length;
  const sbRoleAssignedCount = users.filter((user) => user.sbRoles.length > 0).length;

  async function refreshUsers(nextMessage = "User list refreshed.") {
    setStatus("idle");
    setMessage("Refreshing users...");
    const response = await fetch("/api/admin/users");
    const payload = await response.json();

    if (response.ok) {
      setUsers(payload.users);
      setStatus("success");
      setMessage(nextMessage);
      return;
    }

    setStatus("error");
    setMessage(payload.error ?? "Could not refresh users.");
  }

  function requestSbRoleChange({
    role,
    userId,
    userName,
    variant,
  }: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) {
    setConfirmation({
      kind: "sb-role",
      role,
      userId,
      userName,
      variant,
    });
  }

  async function runConfirmedAction() {
    if (!confirmation) {
      return;
    }

    const current = confirmation;
    setConfirmation(null);

    await updateSbRole({
      role: current.role,
      userId: current.userId,
      variant: current.variant,
    });
  }

  async function updateSbRole({
    role,
    userId,
    variant,
  }: {
    role: SbRole;
    userId: string;
    variant: "assign" | "revoke";
  }) {
    const actionKey = `${userId}:${role}`;
    setPendingAction(actionKey);
    setStatus("idle");
    setMessage(`${variant === "assign" ? "Assigning" : "Revoking"} ${role}...`);
    try {
      const response = await fetch(`/api/admin/roles/${variant}`, {
        body: JSON.stringify({ role, userId, term: selectedTerm }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(payload.error ?? "Role update failed.");
        return;
      }

      await refreshUsers("Student Branch role updated.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Total profiles" value={String(users.length)} />
        <SummaryTile label="UoM verified" value={String(verifiedCount)} />
        <SummaryTile label="SB role holders" value={String(sbRoleAssignedCount)} />
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center w-full justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search profiles..."
                value={query}
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
              Term:
              <select
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary cursor-pointer"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
              >
                {IEEE_TERMS.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button onClick={() => refreshUsers()} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {message ? <Notice message={message} status={status} /> : null}

      <BranchRoleTable
        filteredUsers={filteredUsers}
        pendingAction={pendingAction}
        requestSbRoleChange={requestSbRoleChange}
        selectedTerm={selectedTerm}
      />

      <ConfirmationDialog
        confirmation={confirmation}
        isBusy={Boolean(pendingAction)}
        onCancel={() => setConfirmation(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

function BranchRoleTable({
  filteredUsers,
  pendingAction,
  requestSbRoleChange,
  selectedTerm,
}: {
  filteredUsers: AdminUser[];
  pendingAction: string | null;
  requestSbRoleChange: (input: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) => void;
  selectedTerm: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-[1060px] divide-y divide-border text-left text-sm">
        <thead className="bg-surface-muted text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">Profile</th>
            <th className="px-4 py-3 font-semibold">Google email</th>
            <th className="px-4 py-3 font-semibold">UoM status</th>
            <th className="px-4 py-3 font-semibold">SB roles</th>
            <th className="px-4 py-3 font-semibold">Role control</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {filteredUsers.map((user) => (
            <tr key={user.authUserId}>
              <td className="px-4 py-4">
                <p className="font-medium text-text-primary">
                  {user.name || "Not provided"}
                </p>
                <p className="mt-1 max-w-52 truncate text-xs text-text-muted">
                  {user.uomEmail || user.googleEmail}
                </p>
              </td>
              <td className="px-4 py-4">
                <span className="break-all text-text-primary">{user.googleEmail}</span>
              </td>
              <td className="px-4 py-4">
                <Badge tone={user.uomVerified ? "success" : "warning"}>
                  {user.uomVerified ? user.uomEmail : "Not verified"}
                </Badge>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-1">
                  {user.sbRoleAssignments ? (
                    user.sbRoleAssignments
                      .filter((assignment) => assignment.term === selectedTerm && assignment.active)
                      .map((assignment) => (
                        <Badge key={assignment.$id} tone="primary">
                          {assignment.role}
                        </Badge>
                      ))
                  ) : null}
                  {(!user.sbRoleAssignments || 
                    user.sbRoleAssignments.filter((assignment) => assignment.term === selectedTerm && assignment.active).length === 0) ? (
                    <Badge>None</Badge>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-4">
                <BranchRoleControl
                  pendingAction={pendingAction}
                  requestSbRoleChange={requestSbRoleChange}
                  user={user}
                  selectedTerm={selectedTerm}
                />
              </td>
            </tr>
          ))}
          {filteredUsers.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                No profiles match the current search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function BranchRoleControl({
  pendingAction,
  requestSbRoleChange,
  user,
  selectedTerm,
}: {
  pendingAction: string | null;
  requestSbRoleChange: (input: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) => void;
  user: AdminUser;
  selectedTerm: string;
}) {
  const activeRolesForTerm = (user.sbRoleAssignments ?? [])
    .filter((assignment) => assignment.term === selectedTerm && assignment.active)
    .map((assignment) => assignment.role);

  const assignableRoles = user.uomVerified
    ? SB_ROLES.filter((role) => !activeRolesForTerm.includes(role))
    : [];
  const revokableRoles = SB_ROLES.filter((role) => activeRolesForTerm.includes(role));
  const [selectedAssignRole, setSelectedAssignRole] = useState<SbRole | "">(
    assignableRoles[0] ?? "",
  );
  const [selectedRevokeRole, setSelectedRevokeRole] = useState<SbRole | "">(
    revokableRoles[0] ?? "",
  );
  const currentAssignRole =
    assignableRoles.find((role) => role === selectedAssignRole) ?? assignableRoles[0];
  const currentRevokeRole =
    revokableRoles.find((role) => role === selectedRevokeRole) ?? revokableRoles[0];
  const displayName = user.name || user.googleEmail;

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      <div className="rounded-md border border-border bg-surface-subtle p-3">
        <label className="block text-xs font-semibold text-text-secondary">
          Assign role
          <select
            className={cn(inputClasses, "mt-1")}
            disabled={!currentAssignRole}
            onChange={(event) => setSelectedAssignRole(event.target.value as SbRole)}
            value={currentAssignRole ?? ""}
          >
            {assignableRoles.length > 0 ? (
              assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))
            ) : (
              <option value="">
                {user.uomVerified ? "All roles assigned" : "Verification required"}
              </option>
            )}
          </select>
        </label>
        <Button
          className="mt-2 w-full"
          disabled={
            !currentAssignRole ||
            !user.uomVerified ||
            pendingAction === `${user.authUserId}:${currentAssignRole}`
          }
          onClick={() =>
            currentAssignRole
              ? requestSbRoleChange({
                  role: currentAssignRole,
                  userId: user.authUserId,
                  userName: displayName,
                  variant: "assign",
                })
              : undefined
          }
          type="button"
          variant="secondary"
        >
          <ShieldPlus className="size-4" aria-hidden="true" />
          Review Assign
        </Button>
        {!user.uomVerified ? (
          <p className="mt-2 text-xs leading-5 text-warning">
            Verify UoM email before assigning roles.
          </p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-surface-subtle p-3">
        <label className="block text-xs font-semibold text-text-secondary">
          Revoke role
          <select
            className={cn(inputClasses, "mt-1")}
            disabled={!currentRevokeRole}
            onChange={(event) => setSelectedRevokeRole(event.target.value as SbRole)}
            value={currentRevokeRole ?? ""}
          >
            {revokableRoles.length > 0 ? (
              revokableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))
            ) : (
              <option value="">No role to revoke</option>
            )}
          </select>
        </label>
        <Button
          className="mt-2 w-full"
          disabled={!currentRevokeRole || pendingAction === `${user.authUserId}:${currentRevokeRole}`}
          onClick={() =>
            currentRevokeRole
              ? requestSbRoleChange({
                  role: currentRevokeRole,
                  userId: user.authUserId,
                  userName: displayName,
                  variant: "revoke",
                })
              : undefined
          }
          type="button"
          variant="ghost"
        >
          <ShieldMinus className="size-4" aria-hidden="true" />
          Review Revoke
        </Button>
      </div>
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  isBusy,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!confirmation) {
    return null;
  }

  const details = getConfirmationDetails(confirmation);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Confirm Role Change
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Review this change before it is written to the access-control audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          {details.map((detail) => (
            <div
              className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0"
              key={detail.label}
            >
              <span className="font-medium text-text-secondary">{detail.label}</span>
              <span className="text-right font-medium text-text-primary">
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
            Confirm Change
          </Button>
        </div>
      </div>
    </div>
  );
}

function getConfirmationDetails(confirmation: Confirmation) {
  return [
    { label: "Action", value: confirmation.variant === "assign" ? "Assign" : "Revoke" },
    { label: "Volunteer", value: confirmation.userName },
    { label: "Role", value: confirmation.role },
    { label: "Scope", value: "Student Branch" },
  ];
}

function Notice({ message, status }: { message: string; status: NoticeStatus }) {
  return (
    <p
      className={
        status === "error"
          ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
          : "text-sm text-text-secondary"
      }
    >
      {message}
    </p>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <Check className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
