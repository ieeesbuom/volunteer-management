"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, Check, Clipboard } from "lucide-react";
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
import type {
  FormConnection,
  FormConnectionProvider,
  FormConnectionPurpose,
} from "@/features/forms/types";
import { cn } from "@/lib/utils";

const PROVIDERS: Array<{ label: string; value: FormConnectionProvider }> = [
  { label: "Google Forms", value: "google_forms" },
  { label: "External Builder", value: "external_form_builder" },
  { label: "Other", value: "other" },
];

const PURPOSES: Array<{ label: string; value: FormConnectionPurpose }> = [
  { label: "Registration", value: "registration" },
  { label: "Feedback", value: "feedback" },
  { label: "Attendance", value: "attendance" },
  { label: "Grading", value: "grading" },
  { label: "Other", value: "other" },
];

export function EventFormConnections({
  canManage,
  eventId,
  initialConnections,
}: {
  canManage: boolean;
  eventId: string;
  initialConnections: FormConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [showForm, setShowForm] = useState(initialConnections.length === 0 && canManage);
  const [title, setTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeConnections = connections.filter(
    (connection) => connection.status === "active" && connection.formUrl,
  ) as Array<FormConnection & { formUrl: string }>;

  function handleCopy(id: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    });
  }

  async function submitConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    // Auto-detect provider based on URL
    let provider: FormConnectionProvider = "other";
    if (formUrl.includes("docs.google.com/forms") || formUrl.includes("forms.gle")) {
      provider = "google_forms";
    }

    // Auto-detect purpose based on title keywords
    let purpose: FormConnectionPurpose = "other";
    const titleLower = title.toLowerCase();
    if (titleLower.includes("register") || titleLower.includes("registration") || titleLower.includes("sign up")) {
      purpose = "registration";
    } else if (titleLower.includes("feedback") || titleLower.includes("survey")) {
      purpose = "feedback";
    } else if (titleLower.includes("attendance")) {
      purpose = "attendance";
    } else if (titleLower.includes("grade") || titleLower.includes("grading") || titleLower.includes("score")) {
      purpose = "grading";
    }

    try {
      const response = await fetch("/api/forms/connections", {
        body: JSON.stringify({
          eventId,
          formUrl: formUrl || undefined,
          provider,
          purpose,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        connection?: FormConnection;
        error?: string;
      };

      if (!response.ok || !payload.connection) {
        throw new Error(payload.error ?? "Could not save form connection.");
      }

      setConnections((current) => [payload.connection!, ...current]);
      setTitle("");
      setFormUrl("");
      setShowForm(false);
      setMessage("Form connection saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save form connection.");
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
              Quick access links for volunteers and organizers.
            </CardDescription>
          </div>
          {canManage ? (
            <Button
              onClick={() => setShowForm((value) => !value)}
              type="button"
              variant={showForm ? "outline" : "primary"}
              className="cursor-pointer"
            >
              <Plus className={cn("size-4 transition-transform", showForm && "rotate-45")} aria-hidden="true" />
              {showForm ? "Cancel" : "Add Form Link"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Active Forms Grid/List */}
        {activeConnections.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Active Event Links</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {activeConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full bg-primary-soft/40 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                        {formatPurpose(connection.purpose)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatProvider(connection.provider)}
                      </span>
                    </div>
                    <h4 className="font-bold text-text-primary text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {connection.title}
                    </h4>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <a
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover cursor-pointer"
                      href={connection.formUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Fill Form
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>

                    <button
                      onClick={() => handleCopy(connection.id, connection.formUrl)}
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-subtle p-2.5 text-text-secondary hover:bg-surface hover:text-primary transition cursor-pointer"
                      title="Copy form link"
                    >
                      {copiedId === connection.id ? (
                        <Check className="size-4 text-success" aria-hidden="true" />
                      ) : (
                        <Clipboard className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !showForm ? (
          /* Illustrative Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 px-4 text-center">
            <div className="rounded-full bg-surface-subtle p-4 mb-4">
              <Link2 className="size-8 text-text-muted" aria-hidden="true" />
            </div>
            <h4 className="font-semibold text-text-primary text-base mb-1">No forms linked yet</h4>
            <p className="text-sm text-text-secondary max-w-sm mb-4">
              Volunteers will see direct links here once they are added by the event chair or admin.
            </p>
            {canManage ? (
              <Button onClick={() => setShowForm(true)} variant="outline" className="cursor-pointer">
                <Plus className="size-4" aria-hidden="true" />
                Add First Form
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Add Form connection panel */}
        {showForm ? (
          <div className="rounded-xl border border-border bg-surface-subtle/30 p-5 shadow-inner">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Add Form Link</h3>
            <form className="space-y-4" onSubmit={submitConnection}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-text-secondary">
                  Form Title
                  <input
                    className={cn(eventInputClasses, "mt-1.5 font-normal")}
                    maxLength={160}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Delegates Registration, Feedback Survey"
                    required
                    value={title}
                  />
                </label>
                <label className="block text-sm font-semibold text-text-secondary">
                  Form URL
                  <input
                    className={cn(eventInputClasses, "mt-1.5 font-normal")}
                    maxLength={1024}
                    onChange={(event) => setFormUrl(event.target.value)}
                    placeholder="https://forms.gle/..."
                    required
                    type="url"
                    value={formUrl}
                  />
                </label>
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={submitting || !title || !formUrl} type="submit" variant="primary" className="cursor-pointer w-full sm:w-auto">
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                  Save Form Link
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Form Management Log/Table (Only for Admins/Chairs to audit, kept minimal) */}
        {canManage && connections.length > 0 ? (
          <div className="pt-4 border-t border-border">
            <details className="group cursor-pointer">
              <summary className="text-xs font-semibold text-text-secondary group-hover:text-primary transition-colors flex items-center gap-1.5 select-none cursor-pointer">
                <span>Manage Forms ({connections.length})</span>
              </summary>
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-surface-muted text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Form Title</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Provider</th>
                      <th className="px-4 py-3 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {connections.map((connection) => (
                      <tr key={connection.id} className="hover:bg-surface-subtle/20 transition-colors">
                        <td className="px-4 py-3">
                          <a
                            href={connection.formUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline cursor-pointer"
                          >
                            {connection.title}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={connection.status === "active" ? "success" : "warning"}>
                            {connection.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary capitalize">
                          {formatProvider(connection.provider)}
                        </td>
                        <td className="px-4 py-3 text-text-secondary capitalize">
                          {formatPurpose(connection.purpose)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : null}

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
    </Card>
  );
}

function formatProvider(provider: FormConnectionProvider) {
  return PROVIDERS.find((option) => option.value === provider)?.label ?? provider;
}

function formatPurpose(purpose: FormConnectionPurpose) {
  return PURPOSES.find((option) => option.value === purpose)?.label ?? purpose;
}
