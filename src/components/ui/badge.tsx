import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";
type BadgeSize = "default" | "lg";

export const badgeToneClassName: Record<BadgeTone, string> = {
  neutral: "border-border-subtle bg-neutral-soft text-text-secondary",
  primary: "border-primary/15 bg-primary-soft text-primary",
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-warning/20 bg-warning-soft text-warning",
  danger: "border-danger/20 bg-danger-soft text-danger",
};

const sizeClasses: Record<BadgeSize, string> = {
  default: "px-3 py-1 text-[12px]",
  lg: "px-3.5 py-1.5 text-[14px]",
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
        "inline-flex items-center rounded-full border font-medium leading-snug",
        sizeClasses[size],
        badgeToneClassName[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
