"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BellPlus,
  CalendarDays,
  FileBarChart,
  Flag,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Trophy,
  Menu,
  X,
} from "lucide-react";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/features/access-control/types";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

export function AppShell({
  active,
  children,
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

  const SidebarContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b border-border-subtle">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-soft text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {ORGANIZATION_NAME}
          </p>
          <p className="truncate text-sm font-semibold text-text-primary">{APP_NAME}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 space-y-1 px-3">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary-mid text-primary"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                )}
              >
                <Icon
                  className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary")}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}

          {adminNavItems.length > 0 && (
            <div className="mt-8">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
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
                      className={cn(
                        "group flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary-mid text-primary"
                          : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                      )}
                    >
                      <Icon
                        className={cn("size-[18px] shrink-0", isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary")}
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

      <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-text-secondary">
          {user.authUser.name ? user.authUser.name.charAt(0).toUpperCase() : user.authUser.email.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-text-primary">{user.authUser.name || "Volunteer"}</p>
          <p className="truncate text-[12px] text-text-muted">{user.authUser.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell initialNotifications={[]} initialUnreadCount={0} />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="size-[18px]" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-bg-base text-text-primary">
      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform flex-col bg-surface-raised border-r border-border-subtle transition-transform duration-300 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full flex"
        )}
      >
        <div className="absolute right-0 top-0 -mr-12 pt-4">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white focus:outline-none focus:ring-2 focus:ring-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="sr-only">Close sidebar</span>
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[240px] lg:flex-col lg:border-r lg:border-border-subtle lg:bg-surface-raised">
        <SidebarContent />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:pl-[240px]">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border-subtle bg-surface-raised px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-text-secondary cursor-pointer hover:text-text-primary"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="size-6" aria-hidden="true" />
          </button>
          <div className="flex flex-1 items-center justify-between gap-x-4 lg:hidden">
            <span className="text-sm font-semibold text-text-primary">{APP_NAME}</span>
            <div className="flex items-center gap-3">
              <NotificationBell initialNotifications={[]} initialUnreadCount={0} />
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
