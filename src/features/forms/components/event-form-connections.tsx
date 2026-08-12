"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clipboard,
  ExternalLink,
  FilePenLine,
  Link2,
  ListChecks,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { eventInputClasses } from "@/features/events/lib/event-ui";
import {
  formatAudienceBadge,
  getFormAudienceMetadata,
  isFormVisibleToUser,
  type FormAudienceTier,
} from "@/features/forms/lib/audience";
import {
  defaultGroupAnswersForPurpose,
  getFormPurposeOptions,
  isGroupAnswersEnabled,
} from "@/features/forms/lib/lava-form-presets";
import { createCustomEventFormAction } from "@/features/forms/server/lava-form-actions";
import { lavaEditPath, lavaFillPath } from "@/features/forms/lib/lava-paths";
import type {
  FormConnection,
  FormConnectionProvider,
  FormConnectionPurpose,
} from "@/features/forms/types";
import { isLavaFormProvider } from "@/features/forms/types";
import { cn } from "@/lib/utils";

const PROVIDERS: Array<{ label: string; value: FormConnectionProvider }> = [
  { label: "Google Forms", value: "google_forms" },
  { label: "Custom form", value: "lava" },
  { label: "External Builder", value: "external_form_builder" },
  { label: "Other", value: "other" },
];

const PURPOSES = getFormPurposeOptions();

function detectProvider(url: string): FormConnectionProvider {
  if (url.includes("docs.google.com/forms") || url.includes("forms.gle")) {
    return "google_forms";
  }
  return "other";
}

function getSchedule(connection: FormConnection) {
  const meta = connection.metadata as Record<string, string> | undefined;
  return {
    openAt: meta?.openAt ?? "",
    closeAt: meta?.closeAt ?? "",
  };
}

export function EventFormConnections({
  assignments = [],
  canManage,
  committees = [],
  currentUserId,
  eventId,
  initialConnections,
  isVolunteer = false,
}: {
  assignments?: Array<{
    committeeId?: string;
    committeeName?: string;
    role?: string;
    userId: string;
  }>;
  canManage: boolean;
  committees?: Array<{ $id: string; name: string }>;
  currentUserId?: string;
  eventId: string;
  initialConnections: FormConnection[];
  isVolunteer?: boolean;
}) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [showForm, setShowForm] = useState(initialConnections.length === 0 && canManage);
  const [addMode, setAddMode] = useState<"choose" | "google" | "custom">(
    initialConnections.length === 0 && canManage ? "choose" : "choose",
  );

  const committeesMap = useMemo(
    () => new Map(committees.map((c) => [c.$id, c.name])),
    [committees],
  );

  // Add form state
  const [title, setTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [addPurpose, setAddPurpose] = useState<FormConnectionPurpose>("registration");
  const [addGroupAnswers, setAddGroupAnswers] = useState(false);
  const [addOpenAt, setAddOpenAt] = useState("");
  const [addCloseAt, setAddCloseAt] = useState("");
  const [addAudience, setAddAudience] = useState<FormAudienceTier>("public");
  const [addTargetCommitteeId, setAddTargetCommitteeId] = useState("");

  // Edit form state
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editFormUrl, setEditFormUrl] = useState("");
  const [editPurpose, setEditPurpose] = useState<FormConnectionPurpose>("registration");
  const [editOpenAt, setEditOpenAt] = useState("");
  const [editCloseAt, setEditCloseAt] = useState("");
  const [editAudience, setEditAudience] = useState<FormAudienceTier>("public");
  const [editTargetCommitteeId, setEditTargetCommitteeId] = useState("");

  const [connectionToDelete, setConnectionToDelete] = useState<FormConnection | null>(null);
  const [connectionToClose, setConnectionToClose] = useState<FormConnection | null>(null);
  const [connectionToOpen, setConnectionToOpen] = useState<FormConnection | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Show all connections (active + disabled/closed) filtered by audience access
  const statusVisibleConnections = connections.filter(
    (c) => c.status === "active" || c.status === "disabled",
  ) as FormConnection[];

  const visibleConnections = statusVisibleConnections.filter((conn) =>
    isFormVisibleToUser({
      canManage,
      committeesMap,
      connection: conn,
      currentUserId,
      isVolunteer,
      userRoleAssignments: assignments.map((assignment) => ({
        ...assignment,
        eventId,
      })),
    }),
  );

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function submitConnection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    const metadata: Record<string, string> = {};
    if (addOpenAt) metadata.openAt = addOpenAt;
    if (addCloseAt) metadata.closeAt = addCloseAt;
    if (addAudience && addAudience !== "public") metadata.audience = addAudience;
    if (addAudience === "event_team_only" && addTargetCommitteeId) {
      metadata.targetCommitteeId = addTargetCommitteeId;
      const committeeName = committeesMap.get(addTargetCommitteeId);
      if (committeeName) {
        metadata.targetCommitteeName = committeeName;
      }
    }

    try {
      const response = await fetch("/api/forms/connections", {
        body: JSON.stringify({
          eventId,
          formUrl: formUrl || undefined,
          metadata: Object.keys(metadata).length ? metadata : undefined,
          provider: detectProvider(formUrl),
          purpose: addPurpose,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { connection?: FormConnection; error?: string };

      if (!response.ok || !payload.connection) {
        throw new Error(payload.error ?? "Could not save form connection.");
      }

      setConnections((current) => [payload.connection!, ...current]);
      setTitle("");
      setFormUrl("");
      setAddPurpose("registration");
      setAddGroupAnswers(false);
      setAddOpenAt("");
      setAddCloseAt("");
      setAddAudience("public");
      setAddTargetCommitteeId("");
      setShowForm(false);
      setAddMode("choose");
      setMessage("Form connection saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save form connection.");
    } finally {
      setSubmitting(false);
    }
  }

  function buildAudienceMetadata(openAt: string, closeAt: string, audience: FormAudienceTier, committeeId: string) {
    const metadata: Record<string, string> = {};
    if (openAt) metadata.openAt = openAt;
    if (closeAt) metadata.closeAt = closeAt;
    if (audience && audience !== "public") metadata.audience = audience;
    if (audience === "event_team_only" && committeeId) {
      metadata.targetCommitteeId = committeeId;
      const committeeName = committeesMap.get(committeeId);
      if (committeeName) {
        metadata.targetCommitteeName = committeeName;
      }
    }
    return metadata;
  }

  async function submitCustomForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await createCustomEventFormAction({
        eventId,
        groupAnswersEnabled: addGroupAnswers,
        metadata: buildAudienceMetadata(addOpenAt, addCloseAt, addAudience, addTargetCommitteeId),
        purpose: addPurpose,
        title,
      });

      if ("error" in result) {
        throw new Error(result.error);
      }

      router.push(lavaEditPath(eventId, result.connectionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create custom form.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateConnection(id: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    const metadata: Record<string, string> = {};
    if (editOpenAt) metadata.openAt = editOpenAt;
    if (editCloseAt) metadata.closeAt = editCloseAt;
    if (editAudience && editAudience !== "public") metadata.audience = editAudience;
    if (editAudience === "event_team_only" && editTargetCommitteeId) {
      metadata.targetCommitteeId = editTargetCommitteeId;
      const committeeName = committeesMap.get(editTargetCommitteeId);
      if (committeeName) {
        metadata.targetCommitteeName = committeeName;
      }
    }

    const existing = connections.find((connection) => connection.id === id);
    const isLava = existing ? isLavaFormProvider(existing.provider) : false;
    const nextMetadata: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(existing?.metadata ?? {})) {
      if (typeof value === "string" || typeof value === "boolean") {
        nextMetadata[key] = value;
      }
    }
    Object.assign(nextMetadata, metadata);
    if (isLava) {
      nextMetadata.groupAnswersEnabled = isGroupAnswersEnabled(existing!);
    } else {
      delete nextMetadata.groupAnswersEnabled;
    }
    if (!editOpenAt) delete nextMetadata.openAt;
    if (!editCloseAt) delete nextMetadata.closeAt;
    if (editAudience === "public") {
      delete nextMetadata.audience;
      delete nextMetadata.targetCommitteeId;
      delete nextMetadata.targetCommitteeName;
    }

    try {
      const response = await fetch(`/api/forms/connections/${id}`, {
        body: JSON.stringify({
          formUrl: isLava ? undefined : editFormUrl || undefined,
          metadata: nextMetadata,
          provider: isLava ? "lava" : detectProvider(editFormUrl),
          purpose: editPurpose,
          title: editTitle,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { connection?: FormConnection; error?: string };

      if (!response.ok || !payload.connection) {
        throw new Error(payload.error ?? "Could not update form connection.");
      }

      setConnections((current) =>
        current.map((conn) => (conn.id === id ? payload.connection! : conn)),
      );
      setEditingConnectionId(null);
      setMessage("Form connection updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update form connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConnection(id: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/forms/connections/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Could not delete form connection.");
      }

      setConnections((current) => current.filter((c) => c.id !== id));
      setMessage("Form connection deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete form connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseConnection(id: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/forms/connections/${id}`, {
        body: JSON.stringify({ status: "disabled" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { connection?: FormConnection; error?: string };

      if (!response.ok || !payload.connection) {
        throw new Error(payload.error ?? "Could not close form.");
      }

      setConnections((current) =>
        current.map((conn) => (conn.id === id ? payload.connection! : conn)),
      );
      setConnectionToClose(null);
      setMessage("Form closed. Volunteers can no longer submit responses.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not close form.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopenConnection(id: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/forms/connections/${id}`, {
        body: JSON.stringify({ status: "active" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json()) as { connection?: FormConnection; error?: string };

      if (!response.ok || !payload.connection) {
        throw new Error(payload.error ?? "Could not re-open form.");
      }

      setConnections((current) =>
        current.map((conn) => (conn.id === id ? payload.connection! : conn)),
      );
      setMessage("Form re-opened. Volunteers can submit responses again.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not re-open form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-surface-subtle/50 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Link2 className="size-5 text-primary" aria-hidden="true" />
              Event Forms
            </CardTitle>
            <CardDescription>
              Attach a Google Form link or build a custom in-app form.
            </CardDescription>
          </div>
          {canManage ? (
            <Button
              onClick={() => {
                setShowForm((open) => {
                  if (open) {
                    setAddMode("choose");
                    return false;
                  }
                  setAddMode("choose");
                  return true;
                });
              }}
              type="button"
              variant={showForm ? "secondary" : "primary"}
              className="cursor-pointer"
            >
              <Plus className={cn("size-4 transition-transform", showForm && "rotate-45")} aria-hidden="true" />
              {showForm ? "Cancel" : "Add Form"}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">

        {/* Forms Grid — active + closed */}
        {visibleConnections.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Event Links</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleConnections.map((connection) => {
                const isClosed = connection.status === "disabled";
                const isLava = isLavaFormProvider(connection.provider);
                const fillPath = lavaFillPath(eventId, connection.id);
                const editPath = lavaEditPath(eventId, connection.id);
                const { openAt, closeAt } = getSchedule(connection);
                return (
                  <div
                    key={connection.id}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border p-5 shadow-sm transition-all duration-300",
                      isClosed
                        ? "border-border/60 bg-surface-subtle/60 opacity-75"
                        : "border-border bg-surface hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    )}
                  >
                    {editingConnectionId === connection.id ? (
                      /* ─── Inline Edit Form ─── */
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-text-secondary">
                          Title
                          <input
                            className={cn(eventInputClasses, "mt-1 text-sm font-normal py-1.5")}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            maxLength={160}
                            required
                          />
                        </label>
                        <label className="block text-xs font-semibold text-text-secondary">
                          Purpose
                          <select
                            className={cn(eventInputClasses, "mt-1 text-xs font-normal py-1.5 cursor-pointer")}
                            value={editPurpose}
                            onChange={(e) => setEditPurpose(e.target.value as FormConnectionPurpose)}
                          >
                            {PURPOSES.map((purpose) => (
                              <option key={purpose.value} value={purpose.value}>
                                {purpose.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {isLava ? null : (
                          <label className="block text-xs font-semibold text-text-secondary">
                            URL
                            <input
                              className={cn(eventInputClasses, "mt-1 text-sm font-normal py-1.5")}
                              value={editFormUrl}
                              onChange={(e) => setEditFormUrl(e.target.value)}
                              maxLength={1024}
                              required
                              type="url"
                            />
                          </label>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs font-semibold text-text-secondary">
                            Opens at
                            <input
                              className={cn(eventInputClasses, "mt-1 text-xs font-normal py-1.5")}
                              type="datetime-local"
                              value={editOpenAt}
                              onChange={(e) => setEditOpenAt(e.target.value)}
                            />
                          </label>
                          <label className="block text-xs font-semibold text-text-secondary">
                            Closes at
                            <input
                              className={cn(eventInputClasses, "mt-1 text-xs font-normal py-1.5")}
                              type="datetime-local"
                              value={editCloseAt}
                              onChange={(e) => setEditCloseAt(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <label className="block text-xs font-semibold text-text-secondary">
                            Target Audience
                            <select
                              className={cn(eventInputClasses, "mt-1 text-xs font-normal py-1.5 cursor-pointer")}
                              value={editAudience}
                              onChange={(e) => setEditAudience(e.target.value as FormAudienceTier)}
                            >
                              <option value="public">Public</option>
                              <option value="volunteers_only">Verified Volunteers</option>
                              <option value="event_team_only">Event Team Only</option>
                              <option value="chairs_only">Chairs & Admins Only</option>
                            </select>
                          </label>
                          {editAudience === "event_team_only" && committees.length > 0 ? (
                            <label className="block text-xs font-semibold text-text-secondary">
                              Specific Committee
                              <select
                                className={cn(eventInputClasses, "mt-1 text-xs font-normal py-1.5 cursor-pointer")}
                                value={editTargetCommitteeId}
                                onChange={(e) => setEditTargetCommitteeId(e.target.value)}
                              >
                                <option value="">All Event Team</option>
                                {committees.map((c) => (
                                  <option key={c.$id} value={c.$id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="secondary"
                            className="cursor-pointer h-8 px-3 text-xs"
                            onClick={() => setEditingConnectionId(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            className="cursor-pointer h-8 px-3 text-xs"
                            onClick={() => handleUpdateConnection(connection.id)}
                            disabled={submitting || !editTitle || (!isLava && !editFormUrl)}
                          >
                            {submitting ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Card header row: purpose badge + provider + icon actions */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded-full bg-primary-soft/40 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                                {formatPurpose(connection.purpose)}
                              </span>
                              {(() => {
                                const meta = getFormAudienceMetadata(connection);
                                const badge = formatAudienceBadge(
                                  meta.audience,
                                  meta.targetCommitteeId,
                                  committeesMap,
                                  meta.targetCommitteeName,
                                );
                                return (
                                  <Badge tone={badge.tone} className="text-[11px] py-0 px-2">
                                    {badge.label}
                                  </Badge>
                                );
                              })()}
                              {isClosed && (
                                <span className="inline-flex items-center rounded-full bg-warning-soft/60 px-2 py-0.5 text-xs font-semibold text-warning border border-warning/20">
                                  Closed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-text-muted mr-1">
                                {formatProvider(connection.provider)}
                              </span>
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    title="Edit"
                                    onClick={() => {
                                      const { openAt: oa, closeAt: ca } = getSchedule(connection);
                                      const { audience: aud, targetCommitteeId: tcid } = getFormAudienceMetadata(connection);
                                      setEditingConnectionId(connection.id);
                                      setEditTitle(connection.title);
                                      setEditFormUrl(connection.formUrl ?? "");
                                      setEditPurpose(connection.purpose);
                                      setEditOpenAt(oa);
                                      setEditCloseAt(ca);
                                      setEditAudience(aud);
                                      setEditTargetCommitteeId(tcid ?? "");
                                    }}
                                    className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-surface-subtle hover:text-primary transition cursor-pointer"
                                  >
                                    <Pencil className="size-3.5" aria-hidden="true" />
                                  </button>
                                  {isClosed ? (
                                    <button
                                      type="button"
                                      title="Open form"
                                      disabled={submitting}
                                      onClick={() => setConnectionToOpen(connection)}
                                      className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-success-soft/40 hover:text-success transition cursor-pointer"
                                    >
                                      <Play className="size-3.5" aria-hidden="true" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Close form"
                                      onClick={() => setConnectionToClose(connection)}
                                      className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-warning-soft/40 hover:text-warning transition cursor-pointer"
                                    >
                                      <XCircle className="size-3.5" aria-hidden="true" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title="Delete"
                                    onClick={() => setConnectionToDelete(connection)}
                                    className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-danger-soft/40 hover:text-danger transition cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <h4 className="font-bold text-text-primary text-base line-clamp-1 group-hover:text-primary transition-colors">
                            {connection.title}
                          </h4>

                          {/* Schedule labels */}
                          {(openAt || closeAt) && (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {openAt && (
                                <span className="text-xs text-text-muted">
                                  Opens {new Date(openAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                                </span>
                              )}
                              {closeAt && (
                                <span className="text-xs text-text-muted">
                                  · Closes {new Date(closeAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Buttons — Disabled if closed */}
                        {isLava ? (
                          <div className="mt-4 flex flex-col gap-2">
                            <div className="flex gap-2">
                              {isClosed ? (
                                <button
                                  type="button"
                                  disabled
                                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary/40 px-4 py-2.5 text-sm font-semibold text-white/70 cursor-not-allowed"
                                >
                                  Fill form
                                </button>
                              ) : (
                                <Link
                                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                                  href={fillPath}
                                >
                                  Fill form
                                </Link>
                              )}
                              <button
                                onClick={() =>
                                  handleCopy(
                                    connection.id,
                                    `${window.location.origin}${fillPath}`,
                                  )
                                }
                                type="button"
                                disabled={isClosed}
                                className={cn(
                                  "inline-flex items-center justify-center rounded-lg border bg-surface-subtle p-2.5 text-text-secondary transition",
                                  isClosed
                                    ? "border-border/50 opacity-40 cursor-not-allowed"
                                    : "border-border hover:bg-surface hover:text-primary cursor-pointer",
                                )}
                                title="Copy form link"
                              >
                                {copiedId === connection.id ? (
                                  <Check className="size-4 text-success" aria-hidden="true" />
                                ) : (
                                  <Clipboard className="size-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                            {canManage ? (
                              <div className="flex gap-2">
                                <Link
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-semibold text-text-body transition hover:bg-surface hover:text-primary"
                                  href={editPath}
                                >
                                  <FilePenLine className="size-3.5" aria-hidden="true" />
                                  Edit form
                                </Link>
                                <Link
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-semibold text-text-body transition hover:bg-surface hover:text-primary"
                                  href={`${editPath}#responses`}
                                >
                                  <ListChecks className="size-3.5" aria-hidden="true" />
                                  Responses
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        ) : connection.formUrl ? (
                          <div className="mt-4 flex gap-2">
                            {isClosed ? (
                              <button
                                type="button"
                                disabled
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary/40 px-4 py-2.5 text-sm font-semibold text-white/70 cursor-not-allowed"
                              >
                                Fill Form
                                <ExternalLink className="size-4" aria-hidden="true" />
                              </button>
                            ) : (
                              <a
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover cursor-pointer"
                                href={connection.formUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Fill Form
                                <ExternalLink className="size-4" aria-hidden="true" />
                              </a>
                            )}
                            <button
                              onClick={() => handleCopy(connection.id, connection.formUrl!)}
                              type="button"
                              disabled={isClosed}
                              className={cn(
                                "inline-flex items-center justify-center rounded-lg border bg-surface-subtle p-2.5 text-text-secondary transition",
                                isClosed
                                  ? "border-border/50 opacity-40 cursor-not-allowed"
                                  : "border-border hover:bg-surface hover:text-primary cursor-pointer",
                              )}
                              title="Copy form link"
                            >
                              {copiedId === connection.id ? (
                                <Check className="size-4 text-success" aria-hidden="true" />
                              ) : (
                                <Clipboard className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 text-center text-xs text-text-muted py-2 bg-surface-muted/50 rounded-lg">
                            No form link provided.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : !showForm ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 px-4 text-center">
            <div className="rounded-full bg-surface-subtle p-4 mb-4">
              <Link2 className="size-8 text-text-muted" aria-hidden="true" />
            </div>
            <h4 className="font-semibold text-text-primary text-base mb-1">No forms yet</h4>
            <p className="text-sm text-text-secondary max-w-sm mb-4">
              Volunteers will see Google Form links or in-app custom forms once a chair or admin adds them.
            </p>
            {canManage ? (
              <Button
                onClick={() => {
                  setAddMode("choose");
                  setShowForm(true);
                }}
                variant="secondary"
                className="cursor-pointer"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add First Form
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Add Form Panel */}
        {showForm ? (
          <div className="rounded-xl border border-border bg-surface-subtle/30 p-5 shadow-inner">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              {addMode === "custom" ? "Build custom form" : addMode === "google" ? "Add Google Form link" : "Add form"}
            </h3>
            {addMode === "choose" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
                  onClick={() => setAddMode("google")}
                  type="button"
                >
                  <ExternalLink className="size-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-text-strong">Google Form link</p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Paste an existing Google Form URL. Volunteers open it in a new tab.
                  </p>
                </button>
                <button
                  className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
                  onClick={() => setAddMode("custom")}
                  type="button"
                >
                  <FilePenLine className="size-5 text-primary" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-text-strong">Custom form</p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Build questions in the app. Volunteers fill it here and you can view responses.
                  </p>
                </button>
              </div>
            ) : (
            <form className="space-y-4" onSubmit={addMode === "custom" ? submitCustomForm : submitConnection}>
              <div className={cn("grid gap-4", addMode === "google" && "sm:grid-cols-2")}>
                <label className="block text-sm font-semibold text-text-secondary">
                  Form Title
                  <input
                    className={cn(eventInputClasses, "mt-1.5 font-normal")}
                    maxLength={160}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Delegates Registration, Feedback Survey"
                    required
                    value={title}
                  />
                </label>
                {addMode === "google" ? (
                  <label className="block text-sm font-semibold text-text-secondary">
                    Form URL
                    <input
                      className={cn(eventInputClasses, "mt-1.5 font-normal")}
                      maxLength={1024}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://forms.gle/..."
                      required
                      type="url"
                      value={formUrl}
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-text-secondary">
                  Purpose
                  <select
                    className={cn(eventInputClasses, "mt-1.5 font-normal cursor-pointer")}
                    value={addPurpose}
                    onChange={(e) => {
                      const next = e.target.value as FormConnectionPurpose;
                      setAddPurpose(next);
                      setAddGroupAnswers(defaultGroupAnswersForPurpose(next));
                    }}
                  >
                    {PURPOSES.map((purpose) => (
                      <option key={purpose.value} value={purpose.value}>
                        {purpose.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-text-muted">
                    {PURPOSES.find((purpose) => purpose.value === addPurpose)?.description}
                  </span>
                </label>
                {addMode === "custom" ? (
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">
                    <input
                      checked={addGroupAnswers}
                      className="mt-1 size-4 accent-(--primary)"
                      onChange={(e) => setAddGroupAnswers(e.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <span className="font-semibold text-text-strong">Collect group / team answers</span>
                      <span className="mt-1 block text-xs font-normal text-text-muted">
                        Lets volunteers enter a group size and answer some questions per member. Turn this on for team registrations.
                      </span>
                    </span>
                  </label>
                ) : (
                  <div />
                )}
              </div>

              {/* Schedule */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-text-secondary">
                  Open Date & Time <span className="font-normal text-text-muted">(optional)</span>
                  <input
                    className={cn(eventInputClasses, "mt-1.5 font-normal")}
                    type="datetime-local"
                    value={addOpenAt}
                    onChange={(e) => setAddOpenAt(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-text-secondary">
                  Close Date & Time <span className="font-normal text-text-muted">(optional)</span>
                  <input
                    className={cn(eventInputClasses, "mt-1.5 font-normal")}
                    type="datetime-local"
                    value={addCloseAt}
                    onChange={(e) => setAddCloseAt(e.target.value)}
                  />
                </label>
              </div>

              {/* Audience Scope */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/60">
                <label className="block text-sm font-semibold text-text-secondary">
                  Target Audience
                  <select
                    className={cn(eventInputClasses, "mt-1.5 font-normal cursor-pointer")}
                    value={addAudience}
                    onChange={(e) => setAddAudience(e.target.value as FormAudienceTier)}
                  >
                    <option value="public">Public (Anyone can view & fill)</option>
                    <option value="volunteers_only">Verified Volunteers Only</option>
                    <option value="event_team_only">Event Team (Assigned Roles Only)</option>
                    <option value="chairs_only">Chairs & Admins Only</option>
                  </select>
                </label>
                {addAudience === "event_team_only" && committees.length > 0 ? (
                  <label className="block text-sm font-semibold text-text-secondary">
                    Specific Committee <span className="font-normal text-text-muted">(optional)</span>
                    <select
                      className={cn(eventInputClasses, "mt-1.5 font-normal cursor-pointer")}
                      value={addTargetCommitteeId}
                      onChange={(e) => setAddTargetCommitteeId(e.target.value)}
                    >
                      <option value="">All Event Team Members</option>
                      {committees.map((c) => (
                        <option key={c.$id} value={c.$id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={submitting}
                  onClick={() => setAddMode("choose")}
                  type="button"
                  variant="ghost"
                  className="cursor-pointer w-full sm:w-auto"
                >
                  Back
                </Button>
                <Button
                  disabled={submitting || !title || (addMode === "google" && !formUrl)}
                  type="submit"
                  variant="primary"
                  className="cursor-pointer w-full sm:w-auto"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                  {addMode === "custom" ? "Create and open builder" : "Save Form Link"}
                </Button>
              </div>
            </form>
            )}
          </div>
        ) : null}

        {/* Toast messages */}
        {message ? (
          <p className="rounded-lg border border-success/25 bg-success-soft px-3 py-2 text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </CardContent>

      {/* Delete confirmation */}
      {connectionToDelete ? (
        <ConfirmationDialog
          confirmLabel="Delete Link"
          description={`Are you sure you want to permanently delete "${connectionToDelete.title}"?`}
          isBusy={submitting}
          onCancel={() => setConnectionToDelete(null)}
          onConfirm={async () => {
            await handleDeleteConnection(connectionToDelete.id);
            setConnectionToDelete(null);
          }}
          title="Delete Form Link?"
          variant="danger"
        />
      ) : null}

      {/* Close form confirmation */}
      {connectionToClose ? (
        <ConfirmationDialog
          confirmLabel="Close Form"
          description={`Closing "${connectionToClose.title}" will disable new submissions. You can re-open it by clicking the Open button later.`}
          isBusy={submitting}
          onCancel={() => setConnectionToClose(null)}
          onConfirm={() => handleCloseConnection(connectionToClose.id)}
          title="Close This Form?"
          variant="warning"
        />
      ) : null}

      {/* Open form confirmation */}
      {connectionToOpen ? (
        <ConfirmationDialog
          confirmLabel="Open Form"
          description={`Opening "${connectionToOpen.title}" will enable new submissions. Volunteers can submit responses again.`}
          isBusy={submitting}
          onCancel={() => setConnectionToOpen(null)}
          onConfirm={async () => {
            await handleReopenConnection(connectionToOpen.id);
            setConnectionToOpen(null);
          }}
          title="Open This Form?"
          variant="warning"
        />
      ) : null}
    </Card>
  );
}

function ConfirmationDialog({
  confirmLabel,
  description,
  isBusy,
  onCancel,
  onConfirm,
  title,
  variant = "warning",
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  variant?: "warning" | "danger";
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border",
                variant === "danger"
                  ? "border-danger/25 bg-danger-soft text-danger"
                  : "border-warning/25 bg-warning-soft text-warning",
              )}
            >
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={isBusy} onClick={onCancel} type="button" variant="ghost" className="cursor-pointer">
            Cancel
          </Button>
          <Button
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
            variant={variant === "danger" ? "primary" : "primary"}
            className={cn(
              "cursor-pointer",
              variant === "danger" && "bg-danger hover:bg-danger/90",
            )}
          >
            {isBusy ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatProvider(provider: FormConnectionProvider) {
  return PROVIDERS.find((o) => o.value === provider)?.label ?? provider;
}

function formatPurpose(purpose: FormConnectionPurpose) {
  return PURPOSES.find((o) => o.value === purpose)?.label ?? purpose;
}
