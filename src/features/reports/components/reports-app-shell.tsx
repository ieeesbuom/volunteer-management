"use client";

import { usePathname } from "next/navigation";
import type { SessionUser } from "@/features/access-control/types";
import { AppShell } from "@/components/layout/app-shell";
import { resolveReportsPageTitle } from "@/features/reports/lib/page-titles";

export function ReportsAppShell({
  children,
  user,
}: Readonly<{
  children: React.ReactNode;
  user: SessionUser;
}>) {
  const pathname = usePathname();
  const pageTitle = resolveReportsPageTitle(pathname);

  return (
    <AppShell active="reports" pageTitle={pageTitle} user={user}>
      {children}
    </AppShell>
  );
}
