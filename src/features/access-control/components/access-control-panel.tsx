"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  UsersRound,
} from "lucide-react";
import { volunteerInitials } from "@/components/leaderboard/leaderboard-table-ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { ReportsMetricCard } from "@/features/reports/components/reports-metric-card";
import { eventInputClasses } from "@/features/events/lib/event-ui";
import { IEEE_TERMS, SB_ROLES } from "@/lib/config";
import { cn, formatUserFacingError } from "@/lib/utils";
import { ieeeTermLabelVariants } from "@/features/system-settings/lib/rules";
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
  term: string;
  userId: string;
  userName: string;
  variant: "assign" | "revoke";
};

type NoticeStatus = "error" | "idle" | "success";

const selectClasses = cn(
  eventInputClasses,
  "h-[38px] cursor-pointer",
);

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type SortKey = "profile" | "uom";
type SortDirection = "asc" | "desc";

function sbRolePillClass(role: string) {
  const index = SB_ROLES.indexOf(role as SbRole);
  const palette = [
    "border-primary/15 bg-primary-soft text-primary",
    "border-success/20 bg-success-soft text-success",
    "border-warning/25 bg-warning-soft text-warning",
    "border-border-subtle bg-neutral-soft text-text-body",
    "border-primary/10 bg-primary-mid text-primary",
    "border-success/15 bg-bg-base text-success",
  ];

  return palette[(index >= 0 ? index : role.length) % palette.length];
}

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
      [user.name, user.googleEmail, user.uomEmail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const verifiedCount = users.filter((user) => user.uomVerified).length;
  const sbRoleAssignedCount = users.filter((user) => user.sbRoles.length > 0).length;

  async function refreshUsers(nextMessage = "Profile list refreshed.") {
    setStatus("idle");
    setMessage("Refreshing profiles...");
    const response = await fetch("/api/admin/users");
    const payload = await response.json();

    if (response.ok) {
      setUsers(payload.users);
      setStatus("success");
      setMessage(nextMessage);
      return;
    }

    setStatus("error");
    setMessage(formatUserFacingError(payload.error, "Could not refresh profiles."));
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
      term: selectedTerm,
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
        setMessage(formatUserFacingError(payload.error, "Role update failed. Please try again."));
        return;
      }

      await refreshUsers("Student Branch role updated.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportsMetricCard
          accent="primary"
          icon={UsersRound}
          label="Total profiles"
          value={String(users.length)}
        />
        <ReportsMetricCard
          accent="success"
          icon={BadgeCheck}
          label="UoM verified"
          value={String(verifiedCount)}
        />
        <ReportsMetricCard
          accent="warning"
          icon={ShieldCheck}
          label="SB role holders"
          value={String(sbRoleAssignedCount)}
        />
      </section>

      <Card>
        <CardHeader className="gap-4 border-b border-border-subtle sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" aria-hidden="true" />
              Profile directory
            </CardTitle>
            <CardDescription>
              Only the Admin account can assign or revoke Student Branch roles. A volunteer may hold
              only one active SB role per term—assigning another role replaces the current one.
              Volunteers must verify a UoM email before roles can be granted.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-0 sm:p-0">
          {message ? (
            <div className="px-5 pt-5">
              <Notice message={message} status={status} />
            </div>
          ) : null}

          <BranchRoleTable
            filteredUsers={filteredUsers}
            onRefresh={() => refreshUsers()}
            pendingAction={pendingAction}
            query={query}
            requestSbRoleChange={requestSbRoleChange}
            selectedTerm={selectedTerm}
            setQuery={setQuery}
            setSelectedTerm={setSelectedTerm}
          />
        </CardContent>
      </Card>

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
  onRefresh,
  pendingAction,
  query,
  requestSbRoleChange,
  selectedTerm,
  setQuery,
  setSelectedTerm,
}: {
  filteredUsers: AdminUser[];
  onRefresh: () => void;
  pendingAction: string | null;
  query: string;
  requestSbRoleChange: (input: {
    role: SbRole;
    userId: string;
    userName: string;
    variant: "assign" | "revoke";
  }) => void;
  selectedTerm: string;
  setQuery: (value: string) => void;
  setSelectedTerm: (value: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [sortKey, setSortKey] = useState<SortKey>("profile");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedUsers = useMemo(() => {
    const next = [...filteredUsers];

    next.sort((a, b) => {
      if (sortKey === "profile") {
        const aName = (a.name || a.googleEmail).toLowerCase();
        const bName = (b.name || b.googleEmail).toLowerCase();
        return aName.localeCompare(bName);
      }

      const aVerified = a.uomVerified ? 1 : 0;
      const bVerified = b.uomVerified ? 1 : 0;
      return aVerified - bVerified;
    });

    if (sortDirection === "desc") {
      next.reverse();
    }

    return next;
  }, [filteredUsers, sortDirection, sortKey]);

  const totalCount = sortedUsers.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageUsers = sortedUsers.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeStart = totalCount === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * pageSize, totalCount);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              className={cn(
                eventInputClasses,
                "h-9 border-border-subtle bg-bg-base pl-9 text-[13px] shadow-none",
              )}
              onChange={(event) => {
                setPage(0);
                setQuery(event.target.value);
              }}
              placeholder="Search by name or email..."
              value={query}
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-bg-base px-3 py-1.5 text-[13px] text-text-body shadow-sm">
            <span className="text-text-muted">Term</span>
            <select
              className="max-w-[5.5rem] cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-text-strong outline-none focus:ring-0"
              value={selectedTerm}
              onChange={(event) => {
                setPage(0);
                setSelectedTerm(event.target.value);
              }}
            >
              {IEEE_TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 text-text-muted" aria-hidden="true" />
          </label>
        </div>
        <Button
          className="h-9 shrink-0 cursor-pointer px-3.5"
          onClick={onRefresh}
          type="button"
          variant="secondary"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <UsersRound className="size-8 text-text-placeholder" aria-hidden="true" />
          <p className="text-[13px] font-medium text-text-strong">
            {query.trim() ? "No profiles match your search" : "No profiles yet"}
          </p>
          <p className="max-w-sm text-[12px] text-text-muted">
            {query.trim()
              ? "Try a different name or email, or clear the search field."
              : "Profiles appear here after volunteers sign in with Google."}
          </p>
        </div>
      ) : (
        <>
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-primary-soft/50">
                  <SortableHeader
                    active={sortKey === "profile"}
                    direction={sortDirection}
                    label="Profile"
                    onClick={() => toggleSort("profile")}
                  />
                  <SortableHeader
                    active={sortKey === "uom"}
                    direction={sortDirection}
                    label="UoM status"
                    onClick={() => toggleSort("uom")}
                  />
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    SB roles
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Role actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageUsers.map((user, rowIndex) => {
                  const displayName = user.name || "Not provided";
                  const email = user.uomEmail || user.googleEmail;
                  const termVariants = new Set(ieeeTermLabelVariants(selectedTerm));
                  const activeAssignments = (user.sbRoleAssignments ?? []).filter(
                    (assignment) =>
                      assignment.active && termVariants.has(assignment.term),
                  );
                  const stripe = rowIndex % 2 === 1 ? "bg-bg-base/70" : "bg-surface-raised";

                  return (
                    <tr
                      key={user.authUserId}
                      className={cn(
                        "border-b border-border-subtle/80 transition-colors last:border-b-0 hover:bg-primary-soft/35",
                        stripe,
                      )}
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-[11px] font-bold text-text-strong shadow-sm"
                            aria-hidden
                          >
                            {volunteerInitials(
                              displayName === "Not provided" ? user.googleEmail : displayName,
                            )}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/volunteers/${user.authUserId}`}
                              className="block truncate text-[13px] font-semibold text-text-strong transition-colors hover:text-primary cursor-pointer"
                            >
                              {displayName}
                            </Link>
                            <p className="truncate text-[12px] text-text-muted">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <UomStatusCell user={user} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {activeAssignments.length > 0 ? (
                            activeAssignments.map((assignment) => (
                              <span
                                key={assignment.$id}
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-snug",
                                  sbRolePillClass(assignment.role),
                                )}
                              >
                                {assignment.role}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-text-muted">None for this term</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <BranchRoleControl
                          pendingAction={pendingAction}
                          requestSbRoleChange={requestSbRoleChange}
                          user={user}
                          selectedTerm={selectedTerm}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-base/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[13px] font-medium text-text-body">
              Total{" "}
              <span className="font-semibold tabular-nums text-text-strong">{totalCount}</span>
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[12px] text-text-muted">
                Lines per page
                <select
                  className="h-8 cursor-pointer rounded-lg border border-border-subtle bg-surface-raised px-2 text-[12px] font-medium text-text-body outline-none"
                  value={pageSize}
                  onChange={(event) => {
                    setPage(0);
                    setPageSize(Number(event.target.value));
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] tabular-nums text-text-muted">
                {rangeStart}–{rangeEnd} of {totalCount}
              </p>
              <div className="flex items-center gap-1">
                <PaginationIconButton
                  ariaLabel="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                >
                  <ChevronLeft className="size-4" />
                </PaginationIconButton>
                {buildPageNumbers(safePage, pageCount).map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-[12px] text-text-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={cn(
                        "inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors",
                        item === safePage
                          ? "bg-text-strong text-surface-raised"
                          : "text-text-muted hover:bg-surface-muted hover:text-text-strong",
                      )}
                      onClick={() => setPage(item)}
                      type="button"
                    >
                      {item + 1}
                    </button>
                  ),
                )}
                <PaginationIconButton
                  ariaLabel="Next page"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                >
                  <ChevronRight className="size-4" />
                </PaginationIconButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-strong"
        onClick={onClick}
        type="button"
      >
        {label}
        <ChevronsUpDown
          className={cn("size-3.5", active ? "text-primary" : "text-text-placeholder")}
          aria-hidden="true"
        />
        <span className="sr-only">
          {active ? `Sorted ${direction === "asc" ? "ascending" : "descending"}` : "Sortable"}
        </span>
      </button>
    </th>
  );
}

function UomStatusCell({ user }: { user: AdminUser }) {
  if (user.uomVerified) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
        <span className="truncate text-[13px] font-medium text-text-body">{user.uomEmail}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      <span className="text-[13px] font-medium text-text-body">Not verified</span>
    </div>
  );
}

function PaginationIconButton({
  ariaLabel,
  children,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index);
  }

  if (current <= 1) {
    return [0, 1, 2, "ellipsis", total - 1];
  }

  if (current >= total - 2) {
    return [0, "ellipsis", total - 3, total - 2, total - 1];
  }

  return [0, "ellipsis", current, "ellipsis", total - 1];
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
  const termVariants = new Set(ieeeTermLabelVariants(selectedTerm));
  const activeRolesForTerm = (user.sbRoleAssignments ?? [])
    .filter((assignment) => assignment.active && termVariants.has(assignment.term))
    .map((assignment) => assignment.role);
  const currentRole = activeRolesForTerm[0];

  const assignableRoles = user.uomVerified
    ? SB_ROLES.filter((role) => role !== currentRole)
    : [];
  const revokableRoles = currentRole ? [currentRole] : [];
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
  const assignLabel = currentRole ? "Replace" : "Assign";

  return (
    <div className="flex min-w-[260px] flex-col gap-2.5 rounded-xl border border-border-subtle/80 bg-bg-base/50 p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {assignLabel}
          </label>
          <select
            className={cn(selectClasses, "h-9 bg-surface-raised text-[12px]")}
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
                {user.uomVerified ? "No other roles" : "Verification required"}
              </option>
            )}
          </select>
        </div>
        <Button
          className="h-[38px] shrink-0 cursor-pointer px-3"
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
          <ShieldPlus className="size-3.5" aria-hidden="true" />
          {assignLabel}
        </Button>
      </div>

      {!user.uomVerified ? (
        <p className="text-[11px] leading-4 text-warning">
          Verify UoM email before assigning roles.
        </p>
      ) : currentRole ? (
        <p className="text-[11px] leading-4 text-text-muted">
          One SB role per term. Replacing revokes {currentRole}.
        </p>
      ) : null}

      {revokableRoles.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-2">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Revoke
            </label>
            <select
              className={cn(selectClasses, "h-9 bg-surface-raised text-[12px]")}
              disabled={!currentRevokeRole}
              onChange={(event) => setSelectedRevokeRole(event.target.value as SbRole)}
              value={currentRevokeRole ?? ""}
            >
              {revokableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="h-[38px] shrink-0 cursor-pointer px-3"
            disabled={
              !currentRevokeRole ||
              pendingAction === `${user.authUserId}:${currentRevokeRole}`
            }
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
            <ShieldMinus className="size-3.5" aria-hidden="true" />
            Revoke
          </Button>
        </div>
      ) : null}
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
  const isRevoke = confirmation.variant === "revoke";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[1px]"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-raised shadow-overlay">
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
                isRevoke
                  ? "border-danger/25 bg-danger-soft text-danger"
                  : "border-warning/25 bg-warning-soft text-warning",
              )}
            >
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-text-strong">
                Confirm role change
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                This update is written to the access-control audit trail.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-[13px]">
          {details.map((detail) => (
            <div
              className="flex items-start justify-between gap-4 border-b border-border-subtle pb-2 last:border-0 last:pb-0"
              key={detail.label}
            >
              <span className="font-medium text-text-muted">{detail.label}</span>
              <span className="text-right font-semibold text-text-strong">{detail.value}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
          <Button className="cursor-pointer" disabled={isBusy} onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
            variant={isRevoke ? "danger" : "primary"}
          >
            Confirm change
          </Button>
        </div>
      </div>
    </div>
  );
}

function getConfirmationDetails(confirmation: Confirmation) {
  return [
    {
      label: "Action",
      value: confirmation.variant === "assign" ? "Assign / replace" : "Revoke",
    },
    { label: "Volunteer", value: confirmation.userName },
    { label: "Role", value: confirmation.role },
    { label: "Term", value: confirmation.term },
    { label: "Scope", value: "Student Branch" },
  ];
}

function Notice({ message, status }: { message: string; status: NoticeStatus }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-[13px]",
        status === "error" && "border-danger/25 bg-danger-soft text-danger",
        status === "success" && "border-success/25 bg-success-soft text-success",
        status === "idle" && "border-border-subtle bg-bg-base text-text-muted",
      )}
    >
      {message}
    </div>
  );
}
