"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  Edit,
  History,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatUserFacingError } from "@/lib/utils";
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "@/features/system-settings/lib/display";
import {
  EVENT_ROLE_POWERS,
  formatTermLabel,
  getSuggestedTermRange,
  SB_ROLE_POWERS,
} from "@/features/system-settings/lib/rules";
import { deriveTermFromDate } from "@/features/scoring/lib/helpers";
import type {
  AuditLog,
  AuditLogPage,
  IeeeTerm,
  IeeeTermStatus,
  PermissionOverview,
} from "@/features/system-settings/types";

type PanelTab = "audit" | "permissions" | "terms";
type NoticeStatus = "error" | "idle" | "success";
type TermFormState = {
  endDate: string;
  notes: string;
  startDate: string;
  status: Exclude<IeeeTermStatus, "ACTIVE">;
};
type AuditFilters = {
  action: string;
  actorUserId: string;
  dateFrom: string;
  dateTo: string;
  targetId: string;
};
type Confirmation =
  | { kind: "activate-term"; term: IeeeTerm }
  | { kind: "close-term"; term: IeeeTerm };

const suggestedTerm = getSuggestedTermRange();
const emptyTermForm: TermFormState = {
  endDate: suggestedTerm.endDate,
  notes: "",
  startDate: suggestedTerm.startDate,
  status: "DRAFT",
};
const auditActionOptions = [
  "PROFILE_BOOTSTRAPPED",
  "PROFILE_LOGIN_UPDATED",
  "UOM_VERIFICATION_REQUESTED",
  "UOM_VERIFICATION_CONFIRMED",
  "SB_ROLE_ASSIGNED",
  "SB_ROLE_REVOKED",
  "EVENT_ROLE_ASSIGNED",
  "EVENT_ROLE_REVOKED",
  "IEEE_TERM_CREATED",
  "IEEE_TERM_UPDATED",
  "IEEE_TERM_ACTIVATED",
  "IEEE_TERM_CLOSED",
  "IEEE_TERM_STATE_REPAIRED",
  "TOP_BOARD_EXCLUSION_ADDED",
  "TOP_BOARD_EXCLUSION_REMOVED",
  "SYSTEM_SETTING_UPDATED",
];
const inputClasses =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

export function SystemSettingsPanel({
  initialActiveTermId,
  initialAuditPage,
  initialPermissions,
  initialSelectedTermId,
  initialTerms,
}: {
  initialActiveTermId: string;
  initialAuditPage: AuditLogPage;
  initialPermissions: PermissionOverview;
  initialSelectedTermId: string;
  initialTerms: IeeeTerm[];
}) {
  const [activeTermId, setActiveTermId] = useState(initialActiveTermId);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({
    action: "",
    actorUserId: "",
    dateFrom: "",
    dateTo: "",
    targetId: "",
  });
  const [auditLogs, setAuditLogs] = useState(initialAuditPage.auditLogs);
  const [auditLoaded, setAuditLoaded] = useState(
    initialAuditPage.auditLogs.length > 0 || initialAuditPage.total > 0,
  );
  const [auditNextCursor, setAuditNextCursor] = useState(
    initialAuditPage.nextCursor ?? "",
  );
  const [auditTotal, setAuditTotal] = useState(initialAuditPage.total);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [selectedTermId, setSelectedTermId] = useState(initialSelectedTermId);
  const [status, setStatus] = useState<NoticeStatus>("idle");
  const [tab, setTab] = useState<PanelTab>("permissions");
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);
  const [terms, setTerms] = useState(initialTerms);

  const selectedTerm = terms.find((term) => term.$id === selectedTermId);

  function setNotice(nextStatus: NoticeStatus, nextMessage: string) {
    setStatus(nextStatus);
    setMessage(
      nextStatus === "error"
        ? formatUserFacingError(nextMessage, "An unexpected error occurred. Please try again.")
        : nextMessage,
    );
  }

  function resetTermForm() {
    setEditingTermId(null);
    setTermForm(emptyTermForm);
  }

  function useSuggestedTermDates() {
    const suggested = getSuggestedTermRange();

    setTermForm((current) => ({
      ...current,
      endDate: suggested.endDate,
      startDate: suggested.startDate,
    }));
  }

  async function refreshTerms(
    nextMessage = "IEEE terms refreshed.",
    preferredTermId?: string,
  ) {
    const response = await fetch("/api/admin/settings/terms");
    const payload = await response.json();

    if (!response.ok) {
      setNotice("error", payload.error ?? "Could not refresh terms.");
      return;
    }

    const nextTerms = payload.terms as IeeeTerm[];
    const nextActiveTermId = nextTerms.find((term) => term.active)?.$id ?? "";
    const nextSelectedTermId =
      preferredTermId &&
      nextTerms.some((term) => term.$id === preferredTermId)
        ? preferredTermId
        : selectedTermId &&
            nextTerms.some((term) => term.$id === selectedTermId)
        ? selectedTermId
        : nextActiveTermId || nextTerms[0]?.$id || "";

    setTerms(nextTerms);
    setActiveTermId(nextActiveTermId);
    setSelectedTermId(nextSelectedTermId);
    setNotice("success", nextMessage);
  }

  async function submitTerm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("term:save");
    setNotice("idle", editingTermId ? "Updating IEEE term..." : "Creating IEEE term...");

    try {
      const response = await fetch(
        editingTermId
          ? `/api/admin/settings/terms/${editingTermId}`
          : "/api/admin/settings/terms",
        {
          body: JSON.stringify({
            ...termForm,
            label: formatSafeTermLabel(termForm.startDate),
          }),
          headers: { "Content-Type": "application/json" },
          method: editingTermId ? "PATCH" : "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not save IEEE term.");
        return;
      }

      setTermForm(emptyTermForm);
      setEditingTermId(null);
      await refreshTerms(
        editingTermId ? "IEEE term updated." : "IEEE term created.",
        payload.term?.$id,
      );
    } finally {
      setPendingAction(null);
    }
  }

  function startEditingTerm(term: IeeeTerm) {
    setEditingTermId(term.$id);
    setTermForm({
      endDate: term.endDate.slice(0, 10),
      notes: term.notes ?? "",
      startDate: term.startDate.slice(0, 10),
      status: term.status === "ACTIVE" ? "DRAFT" : term.status,
    });
    setTab("terms");
  }

  async function activateTerm(termId: string) {
    setPendingAction(`term:activate:${termId}`);
    setNotice("idle", "Activating IEEE term...");

    try {
      const response = await fetch(
        `/api/admin/settings/terms/${termId}/activate`,
        { method: "POST" },
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Term activation failed.");
        return;
      }

      await refreshTerms("IEEE term activated.", termId);
    } finally {
      setPendingAction(null);
    }
  }

  async function closeTerm(term: IeeeTerm) {
    setPendingAction(`term:close:${term.$id}`);
    setNotice("idle", "Closing IEEE term...");

    try {
      const response = await fetch(
        `/api/admin/settings/terms/${term.$id}/close`,
        { method: "POST" },
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Term close failed.");
        return;
      }

      await refreshTerms("IEEE term closed.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSavePermissions(nextPowers: {
    eventRolePowers: Record<string, string[]>;
    sbRolePowers: Record<string, string[]>;
  }) {
    setPendingAction("permissions:save");
    setNotice("idle", "Saving role permissions...");

    try {
      const response = await fetch("/api/admin/settings/permissions", {
        body: JSON.stringify(nextPowers),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not save role permissions.");
        return;
      }

      setPermissions(payload.permissions);
      setNotice("success", "Role permissions saved successfully.");
    } catch {
      setNotice("error", "Could not save role permissions.");
    } finally {
      setPendingAction(null);
    }
  }

  async function loadAuditLogs({
    append,
    cursor,
  }: {
    append: boolean;
    cursor?: string;
  }) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(auditFilters)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    params.set("limit", "25");

    if (cursor) {
      params.set("cursor", cursor);
    }

    setPendingAction(append ? "audit:load-more" : "audit:refresh");
    setNotice("idle", "Loading audit logs...");

    try {
      const response = await fetch(
        `/api/admin/settings/audit-logs${params.size ? `?${params}` : ""}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        setNotice("error", payload.error ?? "Could not load audit logs.");
        return;
      }

      const page = payload as AuditLogPage;

      setAuditLogs((current) =>
        append ? [...current, ...page.auditLogs] : page.auditLogs,
      );
      setAuditLoaded(true);
      setAuditNextCursor(page.nextCursor ?? "");
      setAuditTotal(page.total);
      setNotice(
        "success",
        append ? "More audit records loaded." : "Audit logs loaded.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function refreshAuditLogs(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await loadAuditLogs({ append: false });
  }

  async function loadMoreAuditLogs() {
    if (!auditNextCursor) {
      return;
    }

    await loadAuditLogs({ append: true, cursor: auditNextCursor });
  }

  function openTab(nextTab: PanelTab) {
    setTab(nextTab);

    if (nextTab === "audit" && !auditLoaded) {
      void loadAuditLogs({ append: false });
    }
  }

  async function runConfirmedAction() {
    if (!confirmation) {
      return;
    }

    const current = confirmation;
    setConfirmation(null);

    if (current.kind === "activate-term") {
      await activateTerm(current.term.$id);
      return;
    }

    if (current.kind === "close-term") {
      await closeTerm(current.term);
      return;
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2">
        <SummaryTile
          label="Active term"
          value={deriveTermFromDate(new Date().toISOString())}
        />
        <SummaryTile label="Audit records" value={auditLoaded ? String(auditTotal) : "On demand"} />
      </section>

      <div className="inline-flex flex-wrap rounded-md border border-border bg-surface p-1">
        <TabButton active={tab === "permissions"} icon={ShieldCheck} label="Permissions" onClick={() => openTab("permissions")} />
        <TabButton active={tab === "audit"} icon={History} label="Audit" onClick={() => openTab("audit")} />
      </div>

      {message ? <Notice message={message} status={status} /> : null}

      {tab === "terms" ? (
        <TermsPanel
          activeTermId={activeTermId}
          editingTermId={editingTermId}
          pendingAction={pendingAction}
          requestActivate={(term) => setConfirmation({ kind: "activate-term", term })}
          requestClose={(term) => setConfirmation({ kind: "close-term", term })}
          resetTermForm={resetTermForm}
          setEditingTermId={setEditingTermId}
          setTermForm={setTermForm}
          submitTerm={submitTerm}
          termForm={termForm}
          terms={terms}
          useSuggestedTermDates={useSuggestedTermDates}
        />
      ) : null}

      {tab === "permissions" ? (
        <PermissionsPanel
          onSavePermissions={handleSavePermissions}
          pendingAction={pendingAction}
          permissions={permissions}
        />
      ) : null}

      {tab === "audit" ? (
        <AuditPanel
          auditFilters={auditFilters}
          auditLogs={auditLogs}
          auditNextCursor={auditNextCursor}
          auditTotal={auditTotal}
          loadMoreAuditLogs={loadMoreAuditLogs}
          pendingAction={pendingAction}
          refreshAuditLogs={refreshAuditLogs}
          setAuditFilters={setAuditFilters}
        />
      ) : null}

      <ConfirmationDialog
        confirmation={confirmation}
        isBusy={Boolean(pendingAction)}
        onCancel={() => setConfirmation(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}

function TermsPanel({
  activeTermId,
  editingTermId,
  pendingAction,
  requestActivate,
  requestClose,
  resetTermForm,
  setEditingTermId,
  setTermForm,
  submitTerm,
  termForm,
  terms,
  useSuggestedTermDates,
}: {
  activeTermId: string;
  editingTermId: string | null;
  pendingAction: string | null;
  requestActivate: (term: IeeeTerm) => void;
  requestClose: (term: IeeeTerm) => void;
  resetTermForm: () => void;
  setEditingTermId: React.Dispatch<React.SetStateAction<string | null>>;
  setTermForm: React.Dispatch<React.SetStateAction<TermFormState>>;
  submitTerm: (event: React.FormEvent<HTMLFormElement>) => void;
  termForm: TermFormState;
  terms: IeeeTerm[];
  useSuggestedTermDates: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className="rounded-md border border-border bg-surface-subtle p-4"
        onSubmit={submitTerm}
      >
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">
            {editingTermId ? "Edit IEEE term" : "Create IEEE term"}
          </h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          Suggested terms use October 1 to September 30. Admin can edit exact dates after each AGM.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            Label
            <input
              className={cn(inputClasses, "mt-1 bg-surface-muted")}
              readOnly
              required
              value={formatSafeTermLabel(termForm.startDate)}
            />
            <span className="mt-1 block text-xs text-text-muted">
              Automatically derived from the selected start year.
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <label className="block text-sm font-medium text-text-secondary">
              Start date
              <input
                className={cn(inputClasses, "mt-1")}
                onChange={(event) =>
                  setTermForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                required
                type="date"
                value={termForm.startDate}
              />
            </label>

            <label className="block text-sm font-medium text-text-secondary">
              End date
              <input
                className={cn(inputClasses, "mt-1")}
                onChange={(event) =>
                  setTermForm((current) => ({ ...current, endDate: event.target.value }))
                }
                required
                type="date"
                value={termForm.endDate}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-text-secondary">
            Notes
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
              onChange={(event) =>
                setTermForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="AGM notes, transition details, or admin remarks"
              value={termForm.notes}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={pendingAction === "term:save"}
            type="submit"
            variant="primary"
          >
            <Check className="size-4" aria-hidden="true" />
            {editingTermId ? "Update Term" : "Create Term"}
          </Button>
          <Button onClick={useSuggestedTermDates} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Suggested Dates
          </Button>
          {editingTermId ? (
            <Button onClick={resetTermForm} type="button" variant="ghost">
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[900px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Term</th>
              <th className="px-4 py-3 font-semibold">Dates</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {terms.map((term) => (
              <tr key={term.$id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-text-primary">{term.label}</p>
                  {term.notes ? (
                    <p className="mt-1 max-w-72 text-xs leading-5 text-text-muted">
                      {term.notes}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {term.startDate} to {term.endDate}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={term.active ? "success" : term.status === "CLOSED" ? "neutral" : "warning"}>
                      {term.active ? "Active" : term.status}
                    </Badge>
                    {term.$id === activeTermId ? <Badge tone="primary">Selected</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {formatDisplayDate(term.updatedAt)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {term.status !== "CLOSED" ? (
                      <Button
                        onClick={() => {
                          setEditingTermId(term.$id);
                          setTermForm({
                            endDate: term.endDate,
                            notes: term.notes ?? "",
                            startDate: term.startDate,
                            status: "DRAFT",
                          });
                        }}
                        type="button"
                      >
                        Edit
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-text-muted">
                        Historical record
                      </span>
                    )}
                    {!term.active && term.status !== "CLOSED" ? (
                      <Button
                        disabled={pendingAction === `term:activate:${term.$id}`}
                        onClick={() => requestActivate(term)}
                        type="button"
                        variant="primary"
                      >
                        Set Active
                      </Button>
                    ) : null}
                    {term.status !== "CLOSED" ? (
                      <Button
                        disabled={pendingAction === `term:close:${term.$id}`}
                        onClick={() => requestClose(term)}
                        type="button"
                        variant="ghost"
                      >
                        Close
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {terms.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  No IEEE terms are configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionsPanel({
  onSavePermissions,
  pendingAction,
  permissions,
}: {
  onSavePermissions: (powers: {
    eventRolePowers: Record<string, string[]>;
    sbRolePowers: Record<string, string[]>;
  }) => Promise<void>;
  pendingAction: string | null;
  permissions: PermissionOverview;
}) {
  const [sbPowers, setSbPowers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(permissions.sbRoles.map((r) => [r.role, r.powers ?? []])),
  );
  const [eventPowers, setEventPowers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(permissions.eventRoles.map((r) => [r.role, r.powers ?? []])),
  );
  const [editingRole, setEditingRole] = useState<{ role: string; type: "event" | "sb" } | null>(
    null,
  );
  const [confirmSave, setConfirmSave] = useState<{ role: string; type: "event" | "sb" } | null>(
    null,
  );

  function toggleSbPower(role: string, powerId: string) {
    setSbPowers((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(powerId)
        ? current.filter((id) => id !== powerId)
        : [...current, powerId];
      return { ...prev, [role]: next };
    });
  }

  function toggleEventPower(role: string, powerId: string) {
    setEventPowers((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(powerId)
        ? current.filter((id) => id !== powerId)
        : [...current, powerId];
      return { ...prev, [role]: next };
    });
  }

  function handleCancelEdit(role: string, type: "event" | "sb") {
    if (type === "sb") {
      const orig = permissions.sbRoles.find((r) => r.role === role)?.powers ?? [];
      setSbPowers((prev) => ({ ...prev, [role]: orig }));
    } else {
      const orig = permissions.eventRoles.find((r) => r.role === role)?.powers ?? [];
      setEventPowers((prev) => ({ ...prev, [role]: orig }));
    }
    setEditingRole(null);
  }

  async function executeConfirmedSave() {
    if (!confirmSave) {
      return;
    }
    await onSavePermissions({ eventRolePowers: eventPowers, sbRolePowers: sbPowers });
    setConfirmSave(null);
    setEditingRole(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Predefined Role & System Capabilities
            </h3>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Role permissions are predefined by default to ensure secure access control. To inspect what capabilities each role grants, view the active capability list below. If you explicitly need to add or reduce capabilities for a specific role, click <strong>Edit Permissions</strong> next to that role and confirm your changes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RoleTable
          editingRole={editingRole?.type === "sb" ? editingRole.role : null}
          onCancelEdit={(role) => handleCancelEdit(role, "sb")}
          onRequestSave={(role) => setConfirmSave({ role, type: "sb" })}
          onStartEdit={(role) => setEditingRole({ role, type: "sb" })}
          onTogglePower={toggleSbPower}
          powerOptions={SB_ROLE_POWERS}
          powersMap={sbPowers}
          rows={permissions.sbRoles}
          title="Student Branch Roles"
        />
        <RoleTable
          editingRole={editingRole?.type === "event" ? editingRole.role : null}
          onCancelEdit={(role) => handleCancelEdit(role, "event")}
          onRequestSave={(role) => setConfirmSave({ role, type: "event" })}
          onStartEdit={(role) => setEditingRole({ role, type: "event" })}
          onTogglePower={toggleEventPower}
          powerOptions={EVENT_ROLE_POWERS}
          powersMap={eventPowers}
          rows={permissions.eventRoles}
          title="Event Roles"
        />
      </div>

      {confirmSave ? (
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
                    Confirm Role Capabilities Update
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Review this action before applying it across the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                <span className="font-medium text-text-secondary">Role</span>
                <span className="text-right font-semibold text-text-primary">
                  {confirmSave.role}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
                <span className="font-medium text-text-secondary">Category</span>
                <span className="text-right font-medium text-text-primary">
                  {confirmSave.type === "sb" ? "Student Branch Role" : "Event Role"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-text-secondary">Assigned Powers</span>
                <span className="text-right font-medium text-text-primary">
                  {
                    (confirmSave.type === "sb" ? sbPowers : eventPowers)[confirmSave.role]
                      ?.length
                  }{" "}
                  /{" "}
                  {confirmSave.type === "sb"
                    ? SB_ROLE_POWERS.length
                    : EVENT_ROLE_POWERS.length}{" "}
                  capabilities
                </span>
              </div>
              <p className="mt-2 rounded-md bg-surface-muted p-3 text-xs leading-5 text-text-secondary">
                <strong>Important:</strong> Modifying predefined role permissions immediately impacts all volunteers holding this role. Please ensure these capability updates align with IEEE branch security policies.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button
                className="cursor-pointer"
                disabled={pendingAction === "permissions:save"}
                onClick={() => setConfirmSave(null)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="cursor-pointer"
                disabled={pendingAction === "permissions:save"}
                onClick={executeConfirmedSave}
                type="button"
                variant="primary"
              >
                {pendingAction === "permissions:save" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RoleTable({
  editingRole,
  onCancelEdit,
  onRequestSave,
  onStartEdit,
  onTogglePower,
  powerOptions,
  powersMap,
  rows,
  title,
}: {
  editingRole: string | null;
  onCancelEdit: (role: string) => void;
  onRequestSave: (role: string) => void;
  onStartEdit: (role: string) => void;
  onTogglePower: (role: string, powerId: string) => void;
  powerOptions: Array<{ description: string; id: string; label: string }>;
  powersMap: Record<string, string[]>;
  rows: Array<{ notes: string; role: string; scope: string }>;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="border-b border-border bg-surface-muted px-4 py-3">
        <h4 className="font-semibold text-text-primary">{title}</h4>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => {
          const activePowers = powersMap[row.role] ?? [];
          const isEditing = editingRole === row.role;

          return (
            <div className="p-4 transition-colors hover:bg-surface-subtle/50" key={row.role}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone="primary">{row.role}</Badge>
                  <span className="text-xs font-medium text-text-muted">({row.scope})</span>
                </div>
                {!isEditing ? (
                  <Button
                    className="cursor-pointer text-xs h-8 px-2.5"
                    onClick={() => onStartEdit(row.role)}
                    type="button"
                    variant="secondary"
                  >
                    <Edit className="mr-1.5 size-3.5" aria-hidden="true" />
                    Edit Permissions
                  </Button>
                ) : null}
              </div>

              <p className="mt-1.5 text-xs text-text-secondary">{row.notes}</p>

              {isEditing ? (
                <div className="mt-4 rounded-md border border-primary/25 bg-primary/5 p-3">
                  <div className="flex items-center justify-between border-b border-primary/15 pb-2 text-xs font-medium text-primary">
                    <span>Select or deselect capabilities for {row.role}</span>
                    <span>
                      {activePowers.length} / {powerOptions.length} active
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {powerOptions.map((power) => {
                      const isChecked = activePowers.includes(power.id);
                      return (
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs transition-colors",
                            isChecked
                              ? "border-primary/50 bg-surface text-text-primary shadow-2xs"
                              : "border-border/60 bg-surface/60 text-text-secondary hover:bg-surface",
                          )}
                          key={power.id}
                        >
                          <input
                            checked={isChecked}
                            className="mt-0.5 cursor-pointer accent-primary"
                            onChange={() => onTogglePower(row.role, power.id)}
                            type="checkbox"
                          />
                          <div>
                            <span className="block font-medium text-text-primary">
                              {power.label}
                            </span>
                            <span className="block text-[11px] leading-4 text-text-muted">
                              {power.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-primary/15 pt-3">
                    <Button
                      className="cursor-pointer text-xs h-8 px-2.5"
                      onClick={() => onCancelEdit(row.role)}
                      type="button"
                      variant="ghost"
                    >
                      <X className="mr-1.5 size-3.5" aria-hidden="true" />
                      Cancel
                    </Button>
                    <Button
                      className="cursor-pointer text-xs h-8 px-2.5"
                      onClick={() => onRequestSave(row.role)}
                      type="button"
                      variant="primary"
                    >
                      <Check className="mr-1.5 size-3.5" aria-hidden="true" />
                      Review & Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Assigned Capabilities ({activePowers.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {powerOptions
                      .filter((power) => activePowers.includes(power.id))
                      .map((power) => (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium text-text-secondary"
                          key={power.id}
                        >
                          <Check className="size-3 text-primary" aria-hidden="true" />
                          {power.label}
                        </span>
                      ))}
                    {activePowers.length === 0 ? (
                      <span className="text-xs italic text-text-muted">
                        No predefined capabilities assigned. Click Edit Permissions to configure.
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditPanel({
  auditFilters,
  auditLogs,
  auditNextCursor,
  auditTotal,
  loadMoreAuditLogs,
  pendingAction,
  refreshAuditLogs,
  setAuditFilters,
}: {
  auditFilters: AuditFilters;
  auditLogs: AuditLog[];
  auditNextCursor: string;
  auditTotal: number;
  loadMoreAuditLogs: () => Promise<void>;
  pendingAction: string | null;
  refreshAuditLogs: (event?: React.FormEvent<HTMLFormElement>) => void;
  setAuditFilters: React.Dispatch<React.SetStateAction<AuditFilters>>;
}) {
  const actionOptions = Array.from(
    new Set([...auditActionOptions, ...auditLogs.map((log) => log.action)]),
  ).sort();

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4 lg:grid-cols-6"
        onSubmit={refreshAuditLogs}
      >
        <label className="block text-sm font-medium text-text-secondary lg:col-span-2">
          Action
          <select
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, action: event.target.value }))
            }
            value={auditFilters.action}
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Actor reference
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({
                ...current,
                actorUserId: event.target.value,
              }))
            }
            placeholder="Optional internal reference"
            value={auditFilters.actorUserId}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          Target reference
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({
                ...current,
                targetId: event.target.value,
              }))
            }
            placeholder="Optional internal reference"
            value={auditFilters.targetId}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          From
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateFrom: event.target.value }))
            }
            type="date"
            value={auditFilters.dateFrom}
          />
        </label>
        <label className="block text-sm font-medium text-text-secondary">
          To
          <input
            className={cn(inputClasses, "mt-1")}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateTo: event.target.value }))
            }
            type="date"
            value={auditFilters.dateTo}
          />
        </label>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={pendingAction === "audit:refresh"}
            type="submit"
            variant="primary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[980px] divide-y divide-border text-left text-sm">
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {auditLogs.map((log) => (
              <tr key={log.$id}>
                <td className="px-4 py-4 text-text-secondary">
                  {formatDisplayDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <Badge tone="primary">{log.action}</Badge>
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  {log.actorUserId ?? "System"}
                </td>
                <td className="px-4 py-4 text-text-secondary">
                  <p>{log.targetType}</p>
                  <p className="mt-1 max-w-48 truncate text-xs">{log.targetId}</p>
                </td>
                <td className="max-w-96 break-words px-4 py-4 text-xs leading-5 text-text-secondary">
                  {log.metadata ? JSON.stringify(log.metadata) : "None"}
                </td>
              </tr>
            ))}
            {auditLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-text-secondary" colSpan={5}>
                  No audit logs found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Showing {auditLogs.length} of {auditTotal} records
        </p>
        {auditNextCursor ? (
          <Button
            disabled={pendingAction === "audit:load-more"}
            onClick={loadMoreAuditLogs}
            type="button"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load More
          </Button>
        ) : null}
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
                Confirm System Change
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Review this action before it is written to the system audit trail.
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
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

function getConfirmationDetails(confirmation: Confirmation) {
  if (confirmation.kind === "activate-term") {
    return [
      { label: "Action", value: "Set active IEEE term" },
      { label: "Term", value: confirmation.term.label },
      { label: "Dates", value: `${confirmation.term.startDate} to ${confirmation.term.endDate}` },
    ];
  }

  return [
    { label: "Action", value: "Close IEEE term" },
    { label: "Term", value: confirmation.term.label },
    { label: "Dates", value: `${confirmation.term.startDate} to ${confirmation.term.endDate}` },
    {
      label: "Important",
      value: "Closed terms are permanent historical records and cannot be reopened.",
    },
  ];
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-4 py-3">
      <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-white"
          : "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Notice({ message, status }: { message: string; status: NoticeStatus }) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        status === "error" && "border-danger/25 bg-danger-soft text-danger",
        status === "success" && "border-success/25 bg-success-soft text-success",
        status === "idle" && "border-border bg-surface-muted text-text-secondary",
      )}
    >
      {message}
    </div>
  );
}

function formatSafeTermLabel(date: string) {
  try {
    return formatTermLabel(date);
  } catch {
    return "";
  }
}
