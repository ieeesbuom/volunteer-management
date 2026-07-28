"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecommendationRequestForm({
  respondentId,
  respondentName,
}: {
  respondentId: string;
  respondentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function requestRecommendation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/recommendations/request", {
        body: JSON.stringify({ message, respondentId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Recommendation request failed.");
      }

      setMessage("");
      setStatus(`Request sent to ${respondentName}.`);
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recommendation request failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          id="open-recommendation-request"
        >
          Ask for a recommendation
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
        {status ? <p className="text-xs text-text-secondary">{status}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="w-full max-w-sm space-y-2 rounded-md border border-border-subtle bg-surface p-3 shadow-sm"
      onSubmit={requestRecommendation}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Ask for a recommendation
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          aria-label="Close form"
        >
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs text-text-muted">
          Optional context for what you want them to write about.
        </span>
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary"
          maxLength={500}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="e.g. Please mention our work on the Tech Summit…"
          value={message}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving} type="submit" id="send-recommendation-request">
          <Send className="size-3.5" aria-hidden="true" />
          {saving ? "Sending…" : "Send request"}
        </Button>
        {status ? <p className="text-xs text-text-secondary">{status}</p> : null}
      </div>
    </form>
  );
}
