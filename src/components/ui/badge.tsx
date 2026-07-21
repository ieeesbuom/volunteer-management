import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";
type BadgeSize = "default" | "lg";

const toneClasses: Record<BadgeTone, string> = {
  neutral:
    "border-border-default bg-surface-muted text-text-secondary border-l-[3px] border-l-border-strong",
  primary:
    "border-primary/25 bg-primary-soft text-primary border-l-[3px] border-l-primary",
  success:
    "border-success/25 bg-success-soft text-success border-l-[3px] border-l-success",
  warning:
    "border-warning/25 bg-warning-soft text-warning border-l-[3px] border-l-warning",
  danger:
    "border-danger/25 bg-danger-soft text-danger border-l-[3px] border-l-danger",
};

const sizeClasses: Record<BadgeSize, string> = {
  default: "h-[22px] px-2.5 text-[12px]",
  lg: "h-7 px-3 text-[14px]",
};

export function Badge({
  children,
  className,
  tone = "neutral",
  size = "default",
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
  size?: BadgeSize;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border font-medium",
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
