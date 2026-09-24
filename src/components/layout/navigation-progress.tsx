"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const SHOW_DELAY_MS = 150;

type ProgressListeners = Set<() => void>;

const startHeldListeners: ProgressListeners = new Set();
const finishListeners: ProgressListeners = new Set();

/** Start a loader that stays up until finishNavigationProgress. */
export function startHeldNavigationProgress() {
  for (const listener of startHeldListeners) {
    listener();
  }
}

/** @deprecated Prefer AppLink or useProgressRouter so pending is real. */
export function startNavigationProgress() {
  startHeldNavigationProgress();
}

/** Dismiss in-page work that started the loader. */
export function finishNavigationProgress() {
  for (const listener of finishListeners) {
    listener();
  }
}

export async function withNavigationProgress<T>(work: () => Promise<T>): Promise<T> {
  startHeldNavigationProgress();
  try {
    return await work();
  } finally {
    finishNavigationProgress();
  }
}

/** In-page router.push/replace that keeps the overlay until the transition settles. */
export function useProgressRouter() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const heldCountRef = useRef(0);

  useEffect(() => {
    if (isPending || heldCountRef.current === 0) {
      return;
    }
    const outstanding = heldCountRef.current;
    heldCountRef.current = 0;
    for (let index = 0; index < outstanding; index += 1) {
      finishNavigationProgress();
    }
  }, [isPending]);

  useEffect(() => {
    return () => {
      if (heldCountRef.current === 0) {
        return;
      }
      const outstanding = heldCountRef.current;
      heldCountRef.current = 0;
      for (let index = 0; index < outstanding; index += 1) {
        finishNavigationProgress();
      }
    };
  }, []);

  function holdAndNavigate(navigate: () => void) {
    startHeldNavigationProgress();
    heldCountRef.current += 1;
    startTransition(navigate);
  }

  return {
    isPending,
    push(href: string) {
      holdAndNavigate(() => {
        router.push(href);
      });
    },
    replace(href: string) {
      holdAndNavigate(() => {
        router.replace(href);
      });
    },
    refresh() {
      router.refresh();
    },
  };
}

export function NavigationProgress() {
  const [heldPendingCount, setHeldPendingCount] = useState(0);
  const [visible, setVisible] = useState(false);

  const pending = heldPendingCount > 0;

  useEffect(() => {
    if (!pending) {
      const clearTimer = window.setTimeout(() => {
        setVisible(false);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(showTimer);
  }, [pending]);

  useEffect(() => {
    const startHeld = () => setHeldPendingCount((count) => count + 1);
    const finish = () => setHeldPendingCount((count) => Math.max(0, count - 1));
    startHeldListeners.add(startHeld);
    finishListeners.add(finish);

    return () => {
      startHeldListeners.delete(startHeld);
      finishListeners.delete(finish);
    };
  }, []);

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
