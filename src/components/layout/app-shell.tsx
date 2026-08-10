"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import {
  BellPlus,
  CalendarDays,
  FileBarChart,
  Flag,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  UsersRound,
  Trophy,
  Menu,
  X,
} from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/features/access-control/types";
import {
  AppPageNavProvider,
  AppTopNavSpacer,
} from "@/components/layout/app-page-nav-context";
import { AppTopNav } from "@/components/layout/app-top-nav";

const ACTIVE_PAGE_TITLES: Record<
  | "dashboard"
  | "notifications"
  | "settings"
  | "moderation"
  | "events"
  | "my-events"
  | "users"
  | "reports"
  | "scoring"
  | "volunteers",
  string
> = {
  dashboard: "Overview",
  events: "Events",
  "my-events": "My Events",
  scoring: "Scoring & Leaderboard",
  volunteers: "Profile",
  reports: "Reports",
  users: "Access Control",
  settings: "Settings",
  moderation: "Moderation",
  notifications: "Notifications",
};

export function AppShell({
  active,
  children,
  pageTitle,
  user,
}: Readonly<{
  active:
    | "dashboard"
    | "notifications"
    | "settings"
    | "moderation"
    | "events"
    | "my-events"
    | "users"
    | "reports"
    | "scoring"
    | "volunteers";
  children: React.ReactNode;
  /** Matches PageHeader title so SSR and hydration use the same top-nav label. */
  pageTitle?: string;
  user: SessionUser;
}>) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mainNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, id: "dashboard", label: "Overview" },
    { href: "/events", icon: CalendarDays, id: "events", label: "Events" },
    { href: "/scoring", icon: Trophy, id: "scoring", label: "Leaderboard" },
    { href: "/volunteers/me", icon: UserRound, id: "volunteers", label: "Profile" },
  ] as const;

  const adminNavItems = user.isAdmin
    ? ([
        { href: "/reports", icon: FileBarChart, id: "reports", label: "Reports" },
        { href: "/admin/users", icon: UsersRound, id: "users", label: "Access" },
        { href: "/admin/settings", icon: Settings, id: "settings", label: "Settings" },
        { href: "/admin/recommendations", icon: Flag, id: "moderation", label: "Moderation" },
        { href: "/admin/notifications", icon: BellPlus, id: "notifications", label: "Notifications" },
      ] as const)
    : [];

  const renderSidebarContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-border-subtle px-5">
        <Link
          href="/dashboard"
          aria-label="University of Moratuwa IEEE Student Branch"
          className="inline-flex min-w-0 items-center transition-opacity hover:opacity-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo */}
          <img
            src="/images/ieee-sb-uom-logo.png"
            alt=""
            width={1024}
            height={223}
            className="h-9 w-auto max-w-full object-contain object-left"
          />
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 space-y-1.5 px-3">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-xl px-3.5 text-[13px] font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-white"
                    : "text-text-muted hover:bg-bg-base hover:text-text-strong"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-white" : "text-text-placeholder group-hover:text-text-strong",
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}

          {adminNavItems.length > 0 && (
            <div className="mt-6 border-t border-border-subtle pt-4">
              <p className="px-3.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-text-placeholder">
                Administration
              </p>
              <div className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === active;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={false}
                      className={cn(
                        "group flex h-10 items-center gap-3 rounded-xl px-3.5 text-[13px] font-semibold transition-all cursor-pointer",
                        isActive
                          ? "bg-primary text-white"
                          : "text-text-muted hover:bg-bg-base hover:text-text-strong"
                      )}
                    >
                      <Icon
                        className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-white" : "text-text-placeholder group-hover:text-text-strong",
                  )}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle bg-surface-raised p-4">
        {user.authUser.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- custom avatars are same-origin; Google photos need no-referrer
          <img
            src={user.authUser.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-9 shrink-0 rounded-full bg-text-strong object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-text-strong text-xs font-bold text-white">
            {user.authUser.name
              ? user.authUser.name.charAt(0).toUpperCase()
              : user.authUser.email.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-text-strong">{user.authUser.name || "Volunteer"}</p>
          <p className="truncate text-[11px] text-text-muted">{user.authUser.email}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-base hover:text-text-strong"
            title="Sign out"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg-base text-text-strong antialiased">
      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-65 flex transform flex-col border-r border-border-subtle bg-surface-raised transition-transform duration-300 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full flex"
        )}
      >
        <div className="absolute right-0 top-0 -mr-12 pt-4">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white focus:outline-none"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sr-only">Close sidebar</span>
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        {renderSidebarContent()}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border-subtle lg:bg-surface-raised">
        {renderSidebarContent()}
      </div>

      {/* Main content area */}
      <AppPageNavProvider defaultTitle={pageTitle ?? ACTIVE_PAGE_TITLES[active]}>
        <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
          {/* Mobile top bar */}
          <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border-subtle bg-surface-raised px-4 sm:gap-x-6 sm:px-6 lg:hidden">
            <button
              type="button"
              className="-m-2.5 cursor-pointer p-2.5 text-text-muted hover:text-text-strong"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="size-6" aria-hidden="true" />
            </button>
            <div className="flex flex-1 items-center justify-between gap-x-4 lg:hidden">
              <span className="text-sm font-bold text-text-strong">{APP_NAME}</span>
            </div>
          </div>

          <Suspense fallback={<div aria-hidden className="h-[7.5rem] shrink-0 lg:h-[4.5rem]" />}>
            <AppTopNav user={user} />
          </Suspense>
          <AppTopNavSpacer />

          <main className="min-w-0 max-w-full flex-1 overflow-x-hidden px-4 py-4 font-nunito text-text-strong antialiased sm:px-6 lg:px-6">
            {children}
          </main>
        </div>
      </AppPageNavProvider>
    </div>
  );
}
