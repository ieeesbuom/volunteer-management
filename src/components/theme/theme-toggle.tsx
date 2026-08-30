"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Toggle theme"
        className={cn(
          "flex size-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle bg-surface-raised text-text-muted transition-all shadow-xs",
          className,
        )}
      >
        <Sun className="size-4 opacity-40" aria-hidden="true" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-xl border border-border-subtle bg-surface-raised text-text-muted transition-all hover:border-border-default hover:bg-neutral-soft hover:text-text-strong shadow-xs",
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-200 hover:rotate-45" aria-hidden="true" />
      ) : (
        <Moon className="size-4 transition-transform duration-200 hover:-rotate-12" aria-hidden="true" />
      )}
    </button>
  );
}
