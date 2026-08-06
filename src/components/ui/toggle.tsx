import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
        checked
          ? "border-primary bg-primary"
          : "border-border-default bg-bg-base",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block size-[18px] rounded-full border border-border-subtle bg-surface-raised transition-transform duration-150",
          checked ? "translate-x-[21px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
