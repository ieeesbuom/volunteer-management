import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-white shadow-[0_2px_10px_-2px_hsl(216_79%_36%/_0.45)] hover:bg-primary-hover",
  secondary:
    "border-border-default bg-surface-raised text-text-body shadow-sm hover:bg-bg-base",
  ghost:
    "border-transparent bg-transparent text-text-body hover:bg-bg-base hover:text-text-strong",
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
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-[transform,box-shadow,background-color,color,border-color] duration-200 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(216_79%_36%/_0.12)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-px active:scale-[0.99]",
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
