"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VolunteerDirectoryItem } from "@/features/volunteers/types";

const PAGE_SIZE = 50;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function VolunteersDirectory({
  initialItems,
  initialTotal,
}: {
  initialItems: VolunteerDirectoryItem[];
  initialTotal: number;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(async (term: string, offset: number) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (term) {
      params.set("q", term);
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

    return {
      items: payload.items ?? [],
      total: payload.total ?? 0,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!debouncedQuery) {
        setItems(initialItems);
        setTotal(initialTotal);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchPage(debouncedQuery, 0);
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
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
  }, [debouncedQuery, fetchPage, initialItems, initialTotal]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchPage(debouncedQuery, items.length);
      setItems((current) => [...current, ...result.items]);
      setTotal(result.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load more volunteers.");
    } finally {
      setLoadingMore(false);
    }
  }

  const resultLabel = useMemo(() => {
    if (loading) {
      return "Searching…";
    }
    if (debouncedQuery) {
      return `${total} result${total === 1 ? "" : "s"} for “${debouncedQuery}”`;
    }
    return `${total} verified volunteer${total === 1 ? "" : "s"}`;
  }, [debouncedQuery, loading, total]);

  const canLoadMore = !loading && items.length < total;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name…"
          className="h-10 w-full rounded-lg border border-border-subtle bg-surface-raised pl-9 pr-3 text-[13px] text-text-strong outline-none transition-colors placeholder:text-text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/15"
          aria-label="Search volunteers"
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[12px] text-text-muted">
        <p>{resultLabel}</p>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !loading && !error ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-bg-base/60 px-6 py-10 text-center">
          <p className="text-[14px] font-semibold text-text-strong">No volunteers found</p>
          <p className="mt-1 text-[12px] text-text-muted">
            Try a different name, or clear the search to browse everyone.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
          {items.map((volunteer) => (
            <li key={volunteer.userId}>
              <Link
                href={`/volunteers/${volunteer.userId}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg-base"
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary"
                  aria-hidden
                >
                  {initials(volunteer.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-text-strong">
                    {volunteer.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-text-muted">
                    {volunteer.headline || volunteer.skills || "Verified volunteer"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-text-muted">
                  <span className="block font-semibold tabular-nums text-text-body">
                    {volunteer.eventCount}
                  </span>
                  <span>
                    event{volunteer.eventCount === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canLoadMore ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
          >
            {loadingMore ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
