import { cn } from "@/lib/utils";

export function AppPage({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <div className={cn("min-w-0 space-y-4 pb-6", className)}>{children}</div>;
}
