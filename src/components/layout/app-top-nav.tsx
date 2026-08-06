"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { SessionUser } from "@/features/access-control/types";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import {
  DashboardCommandPalette,
  useDashboardCommandPaletteShortcut,
  usePrefersMacModifierKey,
} from "@/features/dashboard/components/dashboard-command-palette";
import { useAppPageNav } from "@/components/layout/app-page-nav-context";

export function AppTopNav({ user }: Readonly<{ user: SessionUser }>) {
  const searchParams = useSearchParams();
  const openNotifications = searchParams.get("tab") === "notifications";
  const {
    displayTitle,
    extras,
    onCommandCustomize,
    opportunityList,
    setNavHeight,
  } = useAppPageNav();

  const navRef = useRef<HTMLDivElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const modifierKeyLabel = usePrefersMacModifierKey();
  const firstName = user.authUser.name?.split(" ")[0] || "Volunteer";

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
    requestAnimationFrame(() => {
      const input = document.getElementById("dashboard-command-search");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }, []);

  useDashboardCommandPaletteShortcut(openCommandPalette);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) {
      return;
    }
    const syncHeight = () => {
      setNavHeight(el.getBoundingClientRect().height);
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    window.addEventListener("resize", syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [displayTitle, extras, setNavHeight]);

  return (
    <>
      <div
        ref={navRef}
        className="fixed top-16 right-0 z-30 border-b border-border-subtle bg-bg-base/95 px-4 pb-4 pt-3 backdrop-blur-sm sm:px-6 lg:top-0 lg:left-60"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <h1 className="shrink-0 text-[17px] font-bold tracking-tight text-text-strong sm:text-[18px]">
            {displayTitle}
          </h1>

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:justify-between">
            <div className="relative flex w-full items-center sm:max-w-md lg:mx-4 lg:flex-1">
              <Search className="pointer-events-none absolute left-4 size-4 text-text-placeholder" />
              <button
                type="button"
                onClick={openCommandPalette}
                className="h-11 w-full cursor-pointer rounded-full border border-border-subtle bg-surface-raised pl-11 pr-16 text-left text-[13px] font-normal text-text-placeholder focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/0.12)] focus:outline-none"
              >
                Search or type a command
              </button>
              <button
                type="button"
                onClick={openCommandPalette}
                title={`Search (${modifierKeyLabel}+F)`}
                suppressHydrationWarning
                className="absolute right-3.5 inline-flex cursor-pointer items-center gap-0.5 rounded-md border border-border-subtle bg-bg-base px-2 py-0.5 text-[11px] font-normal text-text-placeholder transition-colors hover:bg-neutral-soft hover:text-text-body"
              >
                {modifierKeyLabel} F
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3.5">
              {extras}

              <div className="shrink-0">
                <NotificationBell autoOpen={openNotifications} />
              </div>

              <Link
                href="/volunteers/me"
                className="flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-text-strong text-xs font-bold text-white transition-opacity hover:opacity-90"
                title="View Profile"
              >
                {user.authUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Google profile photo URLs are external and require no-referrer
                  <img
                    src={user.authUser.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  firstName.charAt(0).toUpperCase()
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <DashboardCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        user={user}
        opportunityList={opportunityList}
        onCustomize={() => onCommandCustomize?.()}
      />
    </>
  );
}
