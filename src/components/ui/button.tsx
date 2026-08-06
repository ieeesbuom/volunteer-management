import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white hover:bg-primary-hover",
  secondary:
    "border-border-subtle bg-surface-raised text-text-body hover:bg-bg-base",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary",
  danger:
    "border-danger bg-danger text-white hover:bg-danger/90 shadow-[0_2px_10px_-2px_var(--color-danger)]",
};

export function buttonClasses({
  className,
  variant = "secondary",
}: {
  className?: string;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-px",
    variantClasses[variant],
    className,
  );
}

export function Button({
  children,
  className,
  variant = "secondary",
  ...props
}: Readonly<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>) {
  return (
    <button
      className={buttonClasses({ className, variant })}
      {...props}
    >
      {children}
    </button>
  );
}
