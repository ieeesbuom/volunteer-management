import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportsMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: "primary" | "warning" | "success" | "neutral";
};

const accentClasses: Record<
  NonNullable<ReportsMetricCardProps["accent"]>,
  string
> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-neutral",
};

export function ReportsMetricCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: ReportsMetricCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </p>
          <p className="mt-2 text-[26px] font-semibold tabular-nums leading-none text-text-strong">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            accentClasses[accent],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
