"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Users } from "lucide-react";
import type { VolunteerDirectoryItem } from "@/features/volunteers/types";

const PREVIEW_LIMIT = 8;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function VolunteerSearchWidget() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<VolunteerDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PREVIEW_LIMIT),
          offset: "0",
        });
        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }

        const response = await fetch(`/api/volunteers?${params.toString()}`);
        const payload = (await response.json()) as {
          items?: VolunteerDirectoryItem[];
          total?: number;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load volunteers.");
        }

        if (!cancelled) {
          setItems(payload.items ?? []);
          setTotal(payload.total ?? 0);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not search volunteers.");
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="truncate text-[15px] font-semibold text-text-strong">Find volunteers</h2>
        </div>
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-text-muted" aria-hidden /> : null}
      </div>

      <div className="relative mb-3 shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name…"
          className="h-10 w-full rounded-lg border border-border-subtle bg-bg-base/60 pl-9 pr-3 text-[13px] text-text-strong outline-none transition-colors placeholder:text-text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/15"
          aria-label="Search volunteers"
        />
      </div>

      <p className="mb-2 shrink-0 text-[12px] text-text-muted">
        {loading
          ? "Searching…"
          : debouncedQuery
            ? `${total} result${total === 1 ? "" : "s"}`
            : `${total} verified volunteer${total === 1 ? "" : "s"}`}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {!error && items.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-border-subtle bg-bg-base/60 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-text-strong">No volunteers found</p>
            <p className="mt-1 text-[12px] text-text-muted">
              Try another name, or clear the search.
            </p>
          </div>
        ) : null}

        {!error && items.length > 0 ? (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-bg-base/40">
            {items.map((volunteer) => (
              <li key={volunteer.userId}>
                <Link
                  href={`/volunteers/${volunteer.userId}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-primary-soft/40"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary"
                    aria-hidden
                  >
                    {initials(volunteer.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-text-strong">
                      {volunteer.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-text-muted">
                      {volunteer.headline || volunteer.skills || "Verified volunteer"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!loading && total > items.length ? (
        <div className="mt-3 shrink-0 border-t border-border-subtle pt-3">
          <Link
            href="/volunteers"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            View all {total} volunteers
          </Link>
        </div>
      ) : null}
    </div>
  );
}
