"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const SHOW_DELAY_MS = 150;

type ProgressListeners = Set<() => void>;

const startListeners: ProgressListeners = new Set();

/** Start the delayed navigation loader (e.g. from router.push in the command palette). */
export function startNavigationProgress() {
  for (const listener of startListeners) {
    listener();
  }
}

function isInternalNavigationClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) {
    return false;
  }
  if (event.button !== 0) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const anchor = target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return false;
  }
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) {
    return false;
  }

  const next = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next === current && !url.hash) {
    return false;
  }
  // Same path+search with only a hash change is not a route navigation.
  if (next === current) {
    return false;
  }

  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pendingRouteKey, setPendingRouteKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const pending = pendingRouteKey !== null && pendingRouteKey === routeKey;

  useEffect(() => {
    if (!pending) {
      const clearTimer = window.setTimeout(() => {
        setVisible(false);
        setPendingRouteKey(null);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(showTimer);
  }, [pending]);

  useEffect(() => {
    const start = () => setPendingRouteKey(routeKey);
    startListeners.add(start);

    const onClick = (event: MouseEvent) => {
      if (isInternalNavigationClick(event)) {
        start();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      startListeners.delete(start);
      document.removeEventListener("click", onClick, true);
    };
  }, [routeKey]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5 overflow-hidden bg-primary/15"
      >
        <div className="nav-progress-indeterminate h-full w-1/3 bg-primary" />
      </div>
      <div
        aria-live="polite"
        aria-busy="true"
        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-bg-base/60"
      >
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-raised px-4 py-2.5 shadow-md">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          <span className="text-[13px] font-medium text-text-muted">Loading…</span>
        </div>
      </div>
    </>
  );
}
