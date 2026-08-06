"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { eventInputClasses, eventTextareaClasses } from "@/features/events/lib/event-ui";
import { ReportsMetricCard } from "@/features/reports/components/reports-metric-card";
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
const inputClasses = cn(eventInputClasses, "h-[38px]");
const labelClasses =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted";

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
  const [tab, setTab] = useState<PanelTab>("terms");
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);
  const [terms, setTerms] = useState(initialTerms);



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

  const activeTermLabel =
    terms.find((term) => term.active)?.label ?? deriveTermFromDate(new Date().toISOString());

  return (
    <div className="min-w-0 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportsMetricCard
          accent="primary"
          icon={CalendarRange}
          label="Active IEEE term"
          value={activeTermLabel}
        />
        <ReportsMetricCard
          accent="neutral"
          icon={ShieldCheck}
          label="Configured terms"
          value={String(terms.length)}
        />
        <ReportsMetricCard
          accent="warning"
          icon={History}
          label="Audit records"
          value={auditLoaded ? String(auditTotal) : "On demand"}
        />
      </section>

      <div className="border-b border-border-subtle">
        <nav aria-label="Settings sections" className="-mb-px flex flex-wrap gap-0">
          <SettingsTab
            active={tab === "terms"}
            icon={CalendarRange}
            label="IEEE terms"
            onClick={() => openTab("terms")}
          />
          <SettingsTab
            active={tab === "permissions"}
            icon={ShieldCheck}
            label="Permissions"
            onClick={() => openTab("permissions")}
          />
          <SettingsTab
            active={tab === "audit"}
            icon={History}
            label="Audit trail"
            onClick={() => openTab("audit")}
          />
        </nav>
      </div>

      {message ? <Notice message={message} status={status} /> : null}

      <Card className="min-w-0">
        {tab === "terms" ? (
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>IEEE term lifecycle</CardTitle>
            <CardDescription>
              Term dates follow October 1 to September 30 by default. Adjust after each AGM and set
              one active term for branch operations.
            </CardDescription>
          </CardHeader>
        ) : null}
        {tab === "permissions" ? (
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>Role capabilities</CardTitle>
            <CardDescription>
              Predefined Student Branch and event role permissions. Edit only when policy requires a
              change.
            </CardDescription>
          </CardHeader>
        ) : null}
        {tab === "audit" ? (
          <CardHeader className="border-b border-border-subtle">
            <CardTitle>System audit trail</CardTitle>
            <CardDescription>
              Filter and review privileged actions across access control, terms, and configuration.
            </CardDescription>
          </CardHeader>
        ) : null}
        <CardContent className={cn("min-w-0", tab === "audit" ? "p-0" : "p-5")}>
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
    <div className="grid min-w-0 gap-5 lg:grid-cols-1 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
      <form
        className="min-w-0 rounded-2xl border border-border-subtle bg-bg-base/50 p-5 shadow-sm"
        onSubmit={submitTerm}
      >
        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-[15px] font-semibold text-text-strong">
            {editingTermId ? "Edit IEEE term" : "Create IEEE term"}
          </h3>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
          Suggested terms use October 1 to September 30. Admin can edit exact dates after each AGM.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={labelClasses}>Label</span>
            <input
              className={cn(inputClasses, "mt-0 bg-neutral-soft")}
              readOnly
              required
              value={formatSafeTermLabel(termForm.startDate)}
            />
            <span className="mt-1 block text-[11px] text-text-muted">
              Automatically derived from the selected start year.
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="block">
              <span className={labelClasses}>Start date</span>
              <input
                className={inputClasses}
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

            <label className="block">
              <span className={labelClasses}>End date</span>
              <input
                className={inputClasses}
                onChange={(event) =>
                  setTermForm((current) => ({ ...current, endDate: event.target.value }))
                }
                required
                type="date"
                value={termForm.endDate}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClasses}>Notes</span>
            <textarea
              className={eventTextareaClasses}
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
            className="cursor-pointer"
            disabled={pendingAction === "term:save"}
            type="submit"
            variant="primary"
          >
            <Check className="size-4" aria-hidden="true" />
            {editingTermId ? "Update Term" : "Create Term"}
          </Button>
          <Button className="cursor-pointer" onClick={useSuggestedTermDates} type="button">
            <RefreshCw className="size-4" aria-hidden="true" />
            Suggested Dates
          </Button>
          {editingTermId ? (
            <Button className="cursor-pointer" onClick={resetTermForm} type="button" variant="ghost">
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border-subtle bg-primary-soft/50">
                {["Term", "Dates", "Status", "Updated", "Actions"].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted xl:px-4"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {terms.map((term, rowIndex) => (
                <tr
                  key={term.$id}
                  className={cn(
                    "border-b border-border-subtle/80 transition-colors last:border-b-0 hover:bg-primary-soft/30",
                    rowIndex % 2 === 1 ? "bg-bg-base/60" : "bg-surface-raised",
                  )}
                >
                  <td className="px-3 py-3.5 align-top xl:px-4 xl:py-4">
                    <p className="truncate font-semibold text-text-strong">{term.label}</p>
                    {term.notes ? (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-muted">
                        {term.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 align-top xl:px-4 xl:py-4">
                    <div className="text-[12px] leading-snug tabular-nums text-text-body">
                      <span className="block truncate">{term.startDate}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                        to {term.endDate}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 align-top xl:px-4 xl:py-4">
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                      <TermStatusBadge active={term.active} status={term.status} />
                      {term.$id === activeTermId ? (
                        <Badge className="max-w-full truncate" tone="primary">
                          Selected
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 align-top text-[12px] text-text-muted xl:px-4 xl:py-4">
                    {formatDisplayDate(term.updatedAt)}
                  </td>
                  <td className="px-3 py-3.5 align-top xl:px-4 xl:py-4">
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                      {term.status !== "CLOSED" ? (
                        <Button
                          className="h-8 w-full cursor-pointer px-2 text-[11px] sm:w-auto sm:px-3"
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
                          variant="secondary"
                        >
                          Edit
                        </Button>
                      ) : (
                        <span className="text-[11px] font-medium leading-snug text-text-muted">
                          Historical record
                        </span>
                      )}
                      {!term.active && term.status !== "CLOSED" ? (
                        <Button
                          className="h-8 w-full cursor-pointer px-2 text-[11px] sm:w-auto sm:px-3"
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
                          className="h-8 w-full cursor-pointer px-2 text-[11px] sm:w-auto sm:px-3"
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
                  <td className="px-4 py-12 text-center text-[13px] text-text-muted" colSpan={5}>
                    No IEEE terms are configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TermStatusBadge({
  active,
  status,
}: {
  active: boolean;
  status: IeeeTermStatus;
}) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-body">
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />
        Active
      </span>
    );
  }

  if (status === "CLOSED") {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-muted">
        <span className="size-2 rounded-full bg-text-muted" aria-hidden="true" />
        Closed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-body">
      <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
      {status}
    </span>
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
  const [category, setCategory] = useState<"event" | "sb">("sb");
  const [selectedRole, setSelectedRole] = useState<string>(
    () => permissions.sbRoles[0]?.role ?? permissions.eventRoles[0]?.role ?? "",
  );
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

  const rows = category === "sb" ? permissions.sbRoles : permissions.eventRoles;
  const powerOptions = category === "sb" ? SB_ROLE_POWERS : EVENT_ROLE_POWERS;
  const powersMap = category === "sb" ? sbPowers : eventPowers;
  const selectedRow = rows.find((row) => row.role === selectedRole) ?? rows[0];
  const isEditing =
    Boolean(editingRole) &&
    editingRole?.type === category &&
    editingRole.role === selectedRow?.role;

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

  function switchCategory(next: "event" | "sb") {
    if (editingRole) {
      handleCancelEdit(editingRole.role, editingRole.type);
    }
    setCategory(next);
    const nextRows = next === "sb" ? permissions.sbRoles : permissions.eventRoles;
    setSelectedRole(nextRows[0]?.role ?? "");
  }

  function selectRole(role: string) {
    if (editingRole && (editingRole.role !== role || editingRole.type !== category)) {
      handleCancelEdit(editingRole.role, editingRole.type);
    }
    setSelectedRole(role);
  }

  async function executeConfirmedSave() {
    if (!confirmSave) {
      return;
    }
    await onSavePermissions({ eventRolePowers: eventPowers, sbRolePowers: sbPowers });
    setConfirmSave(null);
    setEditingRole(null);
  }

  if (!selectedRow) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-base/40 px-6 py-12 text-center text-[13px] text-text-muted">
        No roles are configured for this category.
      </div>
    );
  }

  const activePowers = powersMap[selectedRow.role] ?? [];

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-[13px] leading-relaxed text-text-muted">
        Capabilities are predefined for each role. Select a role to review what it can do, or edit
        permissions when branch policy requires a change.
      </p>

      <div className="inline-flex rounded-xl border border-border-subtle bg-bg-base p-1">
        <CategorySwitch
          active={category === "sb"}
          icon={ShieldCheck}
          label="Student Branch"
          onClick={() => switchCategory("sb")}
        />
        <CategorySwitch
          active={category === "event"}
          icon={CalendarDays}
          label="Event roles"
          onClick={() => switchCategory("event")}
        />
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-sm lg:grid lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
        <div className="max-h-[420px] overflow-y-auto border-b border-border-subtle lg:max-h-none lg:border-b-0 lg:border-r">
          <p className="border-b border-border-subtle bg-bg-base/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Roles
          </p>
          <ul>
            {rows.map((row) => {
              const count = (powersMap[row.role] ?? []).length;
              const isSelected = row.role === selectedRow.role;

              return (
                <li key={row.role}>
                  <button
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-0.5 border-b border-border-subtle/80 px-4 py-3 text-left transition-colors last:border-b-0",
                      isSelected
                        ? "bg-primary-soft/70"
                        : "hover:bg-bg-base/60",
                    )}
                    onClick={() => selectRole(row.role)}
                    type="button"
                  >
                    <span className="text-[13px] font-semibold text-text-strong">{row.role}</span>
                    <span className="text-[11px] tabular-nums text-text-muted">
                      {count} of {powerOptions.length} enabled
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-semibold text-text-strong">{selectedRow.role}</h3>
                <Badge tone="neutral">{selectedRow.scope}</Badge>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{selectedRow.notes}</p>
            </div>
            {!isEditing ? (
              <Button
                className="h-9 shrink-0 cursor-pointer px-3"
                onClick={() => setEditingRole({ role: selectedRow.role, type: category })}
                type="button"
                variant="secondary"
              >
                <Edit className="size-3.5" aria-hidden="true" />
                Edit permissions
              </Button>
            ) : (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  className="h-9 cursor-pointer px-3"
                  onClick={() => handleCancelEdit(selectedRow.role, category)}
                  type="button"
                  variant="ghost"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  className="h-9 cursor-pointer px-3"
                  onClick={() => setConfirmSave({ role: selectedRow.role, type: category })}
                  type="button"
                  variant="primary"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Review & save
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Capabilities
            </p>
            <span className="rounded-full border border-border-subtle bg-bg-base px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-body">
              {activePowers.length} / {powerOptions.length}
            </span>
          </div>

          <ul className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {powerOptions.map((power) => {
              const enabled = activePowers.includes(power.id);

              return (
                <li
                  className={cn(
                    "flex gap-3 px-3 py-3 sm:px-4",
                    enabled ? "bg-surface-raised" : "bg-bg-base/30",
                  )}
                  key={power.id}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                      enabled
                        ? "border-success/25 bg-success-soft text-success"
                        : "border-border-subtle bg-neutral-soft text-text-placeholder",
                    )}
                    aria-hidden
                  >
                    {enabled ? <Check className="size-3.5" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-text-strong">{power.label}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
                      {power.description}
                    </p>
                  </div>
                  {isEditing ? (
                    <Toggle
                      aria-label={power.label}
                      checked={enabled}
                      className="shrink-0"
                      onCheckedChange={() =>
                        category === "sb"
                          ? toggleSbPower(selectedRow.role, power.id)
                          : toggleEventPower(selectedRow.role, power.id)
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {isEditing ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning-soft/60 px-3 py-2.5 text-[12px] leading-relaxed text-text-body">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
              Changes apply to every volunteer with this role after you confirm and save.
            </p>
          ) : null}
        </div>
      </div>

      {confirmSave ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[1px]"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-raised shadow-overlay">
            <div className="border-b border-border-subtle px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-warning-soft text-warning">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-text-strong">
                    Confirm role capabilities update
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                    Review this action before applying it across the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4 text-[13px]">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-2">
                <span className="font-medium text-text-muted">Role</span>
                <span className="text-right font-semibold text-text-strong">
                  {confirmSave.role}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-2">
                <span className="font-medium text-text-muted">Category</span>
                <span className="text-right font-medium text-text-body">
                  {confirmSave.type === "sb" ? "Student Branch Role" : "Event Role"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-text-muted">Assigned powers</span>
                <span className="text-right font-medium text-text-body">
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
              <p className="mt-2 rounded-xl border border-border-subtle bg-bg-base p-3 text-[12px] leading-relaxed text-text-muted">
                <strong className="font-semibold text-text-body">Important:</strong> Modifying
                predefined role permissions immediately impacts all volunteers holding this role.
                Please ensure these capability updates align with IEEE branch security policies.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
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

function CategorySwitch({
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
        "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
        active
          ? "bg-surface-raised text-text-strong shadow-sm"
          : "text-text-muted hover:text-text-body",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
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
    <div className="min-w-0">
      <form
        className="grid gap-3 border-b border-border-subtle bg-bg-base/40 px-4 py-4 lg:grid-cols-6 sm:px-5"
        onSubmit={refreshAuditLogs}
      >
        <label className="block lg:col-span-2">
          <span className={labelClasses}>Action</span>
          <select
            className={cn(inputClasses, "cursor-pointer")}
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
        <label className="block">
          <span className={labelClasses}>Actor reference</span>
          <input
            className={inputClasses}
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
        <label className="block">
          <span className={labelClasses}>Target reference</span>
          <input
            className={inputClasses}
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
        <label className="block">
          <span className={labelClasses}>From</span>
          <input
            className={inputClasses}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateFrom: event.target.value }))
            }
            type="date"
            value={auditFilters.dateFrom}
          />
        </label>
        <label className="block">
          <span className={labelClasses}>To</span>
          <input
            className={inputClasses}
            onChange={(event) =>
              setAuditFilters((current) => ({ ...current, dateTo: event.target.value }))
            }
            type="date"
            value={auditFilters.dateTo}
          />
        </label>
        <div className="flex items-end">
          <Button
            className="h-[38px] w-full cursor-pointer"
            disabled={pendingAction === "audit:refresh"}
            type="submit"
            variant="primary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-primary-soft/50">
              {["Created", "Action", "Actor", "Target", "Metadata"].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, rowIndex) => (
              <tr
                key={log.$id}
                className={cn(
                  "border-b border-border-subtle/80 transition-colors last:border-b-0 hover:bg-primary-soft/30",
                  rowIndex % 2 === 1 ? "bg-bg-base/60" : "bg-surface-raised",
                )}
              >
                <td className="px-4 py-3.5 text-[13px] tabular-nums text-text-muted">
                  {formatDisplayDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex max-w-[220px] truncate rounded-full border border-primary/15 bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-text-body">
                  {log.actorUserId ?? "System"}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-text-body">
                  <p>{log.targetType}</p>
                  <p className="mt-0.5 max-w-48 truncate text-[12px] text-text-muted">
                    {log.targetId}
                  </p>
                </td>
                <td className="max-w-96 break-words px-4 py-3.5 text-[12px] leading-relaxed text-text-muted">
                  {log.metadata ? JSON.stringify(log.metadata) : "None"}
                </td>
              </tr>
            ))}
            {auditLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-14 text-center text-[13px] text-text-muted" colSpan={5}>
                  No audit logs found for the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-base/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[13px] text-text-body">
          Total{" "}
          <span className="font-semibold tabular-nums text-text-strong">{auditTotal}</span>
          <span className="text-text-muted"> · showing {auditLogs.length} loaded</span>
        </p>
        {auditNextCursor ? (
          <Button
            className="cursor-pointer"
            disabled={pendingAction === "audit:load-more"}
            onClick={loadMoreAuditLogs}
            type="button"
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Load more
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[1px]"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-raised shadow-overlay">
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-warning/25 bg-warning-soft text-warning">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-text-strong">Confirm system change</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                Review this action before it is written to the system audit trail.
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
          <Button className="cursor-pointer" disabled={isBusy} onClick={onConfirm} type="button" variant="primary">
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

function SettingsTab({
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
        "inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-semibold transition-colors",
        active
          ? "border-text-strong text-text-strong"
          : "border-transparent text-text-muted hover:border-border-default hover:text-text-body",
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

function formatSafeTermLabel(date: string) {
  try {
    return formatTermLabel(date);
  } catch {
    return "";
  }
}
