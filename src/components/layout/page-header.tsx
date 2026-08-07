"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";

export function PageHeader({
  actions,
  eyebrow,
  title,
  description,
  className,
  showTitle = false,
}: Readonly<{
  actions?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  /** Render the title inline (use on public pages without AppTopNav). */
  showTitle?: boolean;
}>) {
  const { setPageNav } = useAppPageNav();

  useEffect(() => {
    setPageNav({ title, description: description ?? null });
    return () => setPageNav({ title: null, description: null });
  }, [title, description, setPageNav]);

  if (!actions && !description && !eyebrow && !showTitle) {
    return null;
  }

  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
        ) : null}
        {showTitle ? (
          <h1
            className={cn(
              "text-[17px] font-bold tracking-tight text-text-strong sm:text-[18px]",
              eyebrow ? "mt-2" : undefined,
            )}
          >
            {title}
          </h1>
        ) : null}
        {description ? (
          <p
            className={cn(
              "text-[13px] leading-relaxed text-text-muted",
              eyebrow || showTitle ? "mt-2" : undefined,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
