import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";
type BadgeSize = "default" | "lg";

export const badgeToneClassName: Record<BadgeTone, string> = {
  neutral: "border-border-subtle border-l-[3px] border-l-neutral bg-neutral-soft text-text-body",
  primary: "border-primary/15 border-l-[3px] border-l-primary bg-primary-soft text-primary",
  success: "border-success/20 border-l-[3px] border-l-success bg-success-soft text-success",
  warning: "border-warning/20 border-l-[3px] border-l-warning bg-warning-soft text-warning",
  danger: "border-danger/20 border-l-[3px] border-l-danger bg-danger-soft text-danger",
};

const sizeClasses: Record<BadgeSize, string> = {
  default: "h-[22px] px-2.5 text-[12px]",
  lg: "h-7 px-3.5 text-[14px]",
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
        "inline-flex items-center rounded-full border font-medium leading-none",
        sizeClasses[size],
        badgeToneClassName[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
