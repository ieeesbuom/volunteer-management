import { cn } from "@/lib/utils";

type CardVariant = "default" | "highlight";

const cardVariantClasses: Record<CardVariant, string> = {
  default: "bg-surface-raised text-text-strong border-border-subtle",
  highlight:
    "bg-[linear-gradient(to_bottom_right,var(--color-surface-raised),var(--color-primary-soft))] border-border-subtle border-l-[4px] border-l-primary",
};

export function Card({
  children,
  className,
  variant = "default",
  navigable = false,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  navigable?: boolean;
}>) {
  return (
    <section
      className={cn(
        "rounded-2xl border shadow-sm",
        cardVariantClasses[variant],
        navigable &&
          "cursor-pointer transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-px hover:shadow-md hover:border-border-default",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={cn("border-b border-border-subtle px-5 py-4", className)}>{children}</div>;
}

export function CardContent({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <h2 className={cn("text-[15px] font-semibold text-text-strong", className)}>
      {children}
    </h2>
  );
}

export function CardDescription({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <p className={cn("mt-1 text-sm leading-6 text-text-muted", className)}>
      {children}
    </p>
  );
}
