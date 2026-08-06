"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  ClipboardList,
  FileBarChart,
  LayoutGrid,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const overviewItem = {
  href: "/reports",
  icon: LayoutGrid,
  label: "Overview",
} as const;

const recognitionItem = {
  href: "/reports/recognition",
  icon: Award,
  label: "Recognition",
} as const;

const volunteersItem = {
  href: "/reports/volunteers",
  icon: UsersRound,
  label: "Exports",
} as const;

const conclusionsItem = {
  href: "/reports/conclusions",
  icon: ClipboardList,
  label: "Conclusion Reports",
} as const;

type ReportsNavProps = {
  canAccessConclusions: boolean;
  isAdmin: boolean;
};

export function ReportsNav({ canAccessConclusions, isAdmin }: ReportsNavProps) {
  const pathname = usePathname();

  const items = isAdmin
    ? [overviewItem, recognitionItem, conclusionsItem, volunteersItem]
    : canAccessConclusions
      ? [recognitionItem, conclusionsItem]
      : [recognitionItem];

  return (
    <nav
      aria-label="Reports navigation"
      className="mb-4 flex overflow-x-auto border-b border-border-subtle"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/reports"
            ? pathname === "/reports"
            : pathname.startsWith(item.href);

        return (
          <Link
            className={cn(
              "relative flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-4 text-[14px] font-medium transition-colors cursor-pointer",
              isActive
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text-body",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ReportsPageIcon() {
  return <FileBarChart className="size-4 text-primary" aria-hidden="true" />;
}
