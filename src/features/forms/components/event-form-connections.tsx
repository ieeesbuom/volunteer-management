"use client";

import { useState } from "react";
import { ExternalLink, Link2, Loader2, Plus } from "lucide-react";
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
  const [provider, setProvider] = useState<FormConnectionProvider>("google_forms");
  const [purpose, setPurpose] = useState<FormConnectionPurpose>("registration");
  const [formUrl, setFormUrl] = useState("");
  const [externalFormId, setExternalFormId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registrationConnections = connections.filter(
    (connection) =>
      connection.status === "active" &&
      connection.purpose === "registration" &&
      connection.formUrl,
  ) as Array<FormConnection & { formUrl: string }>;

  async function submitConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/forms/connections", {
        body: JSON.stringify({
          eventId,
          externalFormId: externalFormId || undefined,
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
      setExternalFormId("");
      setPurpose("registration");
      setProvider("google_forms");
      setShowForm(false);
      setMessage("Form connection saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save form connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" aria-hidden="true" />
              Event Forms
            </CardTitle>
            <CardDescription>
              Google Forms and external links connected to this event.
            </CardDescription>
          </div>
          {canManage ? (
            <Button onClick={() => setShowForm((value) => !value)} type="button">
              <Plus className="size-4" aria-hidden="true" />
              {showForm ? "Close" : "Add Form"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {registrationConnections.length > 0 ? (
          <div className="rounded-md border border-primary/20 bg-primary-soft/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">OC Registration</p>
                <p className="text-xs text-text-secondary">
                  Registration form connected for this event.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {registrationConnections.map((connection) => (
                  <a
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
                    href={connection.formUrl}
                    key={connection.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {connection.title || "Open Registration"}
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showForm ? (
          <form className="grid gap-4 rounded-md border border-border bg-surface-subtle p-4 md:grid-cols-2" onSubmit={submitConnection}>
            <label className="block text-sm font-medium text-text-secondary">
              Title
              <input
                className={cn(eventInputClasses, "mt-1")}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Provider
              <select
                className={cn(eventInputClasses, "mt-1")}
                onChange={(event) => setProvider(event.target.value as FormConnectionProvider)}
                value={provider}
              >
                {PROVIDERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Purpose
              <select
                className={cn(eventInputClasses, "mt-1")}
                onChange={(event) => setPurpose(event.target.value as FormConnectionPurpose)}
                value={purpose}
              >
                {PURPOSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Form URL
              <input
                className={cn(eventInputClasses, "mt-1")}
                maxLength={1024}
                onChange={(event) => setFormUrl(event.target.value)}
                placeholder="https://forms.gle/..."
                type="url"
                value={formUrl}
              />
            </label>
            <label className="block text-sm font-medium text-text-secondary md:col-span-2">
              Provider form reference
              <input
                className={cn(eventInputClasses, "mt-1")}
                maxLength={256}
                onChange={(event) => setExternalFormId(event.target.value)}
                placeholder="Optional provider reference"
                value={externalFormId}
              />
            </label>
            <div className="flex justify-end md:col-span-2">
              <Button disabled={submitting || (!formUrl && !externalFormId)} type="submit" variant="primary">
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Save Form
              </Button>
            </div>
          </form>
        ) : null}

        {connections.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-[720px] divide-y divide-border text-left text-sm">
              <thead className="bg-surface-muted text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Form</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {connections.map((connection) => (
                  <tr key={connection.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{connection.title}</p>
                      {connection.externalFormId ? (
                        <p className="mt-1 text-xs text-text-muted">
                          {connection.externalFormId}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatPurpose(connection.purpose)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatProvider(connection.provider)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={connection.status === "active" ? "success" : "warning"}>
                        {connection.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {connection.formUrl ? (
                        <a
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                          href={connection.formUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-xs text-text-muted">No URL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No forms are connected to this event.
          </p>
        )}

        {message ? (
          <p className="rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
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
