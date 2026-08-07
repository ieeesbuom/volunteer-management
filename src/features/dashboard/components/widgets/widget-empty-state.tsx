"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WidgetEmptyState({
  title = "No data yet",
  description = "Live metrics will appear here once volunteer activity is recorded.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-bg-base/60 px-6 py-8 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-border-subtle bg-surface-raised text-text-muted">
        <BarChart3 className="size-5" aria-hidden />
      </div>
      <p className="text-[14px] font-semibold text-text-strong">{title}</p>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}
