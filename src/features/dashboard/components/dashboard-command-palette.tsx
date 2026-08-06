"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  BellPlus,
  CalendarDays,
  FileBarChart,
  Flag,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Plus,
  Search,
  Settings,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@/features/access-control/types";
import type { DashboardOpportunityItem } from "@/features/dashboard/lib/opportunity-types";
import type { Event } from "@/features/events/types";

type CommandItem = {
  id: string;
  label: string;
  subtitle?: string;
  group: string;
  icon: LucideIcon;
  href?: string;
  externalHref?: string;
  onSelect?: () => void;
  searchText: string;
};

function normalizeSearchText(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function itemMatchesQuery(item: CommandItem, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.every((token) => item.searchText.includes(token));
}

const emptySubscribe = () => () => {};

export function DashboardCommandPalette({
  open,
  onOpenChange,
  user,
  opportunityList,
  onCustomize,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  opportunityList: DashboardOpportunityItem[];
  onCustomize: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || eventsLoaded) {
      return;
    }
    let cancelled = false;
    void fetch("/api/events?limit=100")
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as { events?: Event[] };
      })
      .then((data) => {
        if (!cancelled && data?.events) {
          setEvents(data.events);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEventsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventsLoaded]);

  const allItems = useMemo(() => {
    const items: CommandItem[] = [
      {
        id: "nav-dashboard",
        group: "Navigation",
        label: "Overview",
        subtitle: "Dashboard home",
        icon: LayoutDashboard,
        href: "/dashboard",
        searchText: normalizeSearchText(["overview", "dashboard", "home"]),
      },
      {
        id: "nav-events",
        group: "Navigation",
        label: "Events",
        subtitle: "Browse and manage events",
        icon: CalendarDays,
        href: "/events",
        searchText: normalizeSearchText(["events", "projects", "directory"]),
      },
      {
        id: "nav-scoring",
        group: "Navigation",
        label: "Leaderboard",
        subtitle: "Scores and rankings",
        icon: Trophy,
        href: "/scoring",
        searchText: normalizeSearchText(["leaderboard", "scoring", "points", "rank"]),
      },
      {
        id: "nav-profile",
        group: "Navigation",
        label: "Profile",
        subtitle: "Your volunteer profile",
        icon: UserRound,
        href: "/volunteers/me",
        searchText: normalizeSearchText(["profile", "volunteer", "me"]),
      },
      {
        id: "action-new-project",
        group: "Actions",
        label: "New project",
        subtitle: "Create or open events",
        icon: Plus,
        href: "/events",
        searchText: normalizeSearchText(["new", "project", "create", "event"]),
      },
      {
        id: "action-customize",
        group: "Actions",
        label: "Customize dashboard",
        subtitle: "Edit widgets and layout",
        icon: LayoutGrid,
        onSelect: onCustomize,
        searchText: normalizeSearchText(["customize", "widgets", "layout", "edit", "dashboard"]),
      },
    ];

    if (user.isAdmin) {
      items.push(
        {
          id: "nav-reports",
          group: "Navigation",
          label: "Reports",
          icon: FileBarChart,
          href: "/reports",
          searchText: normalizeSearchText(["reports", "admin"]),
        },
        {
          id: "nav-access",
          group: "Navigation",
          label: "Access",
          icon: UsersRound,
          href: "/admin/users",
          searchText: normalizeSearchText(["access", "users", "admin"]),
        },
        {
          id: "nav-settings",
          group: "Navigation",
          label: "Settings",
          icon: Settings,
          href: "/admin/settings",
          searchText: normalizeSearchText(["settings", "admin"]),
        },
        {
          id: "nav-moderation",
          group: "Navigation",
          label: "Moderation",
          icon: Flag,
          href: "/admin/recommendations",
          searchText: normalizeSearchText(["moderation", "recommendations", "admin"]),
        },
        {
          id: "nav-notifications-admin",
          group: "Navigation",
          label: "Notifications",
          icon: BellPlus,
          href: "/admin/notifications",
          searchText: normalizeSearchText(["notifications", "admin"]),
        },
      );
    }

    for (const { conn, event } of opportunityList) {
      const title = event?.title || conn.title;
      items.push({
        id: `opp-${conn.id}`,
        group: "Open opportunities",
        label: title,
        subtitle: conn.title !== title ? conn.title : "Volunteer registration",
        icon: Megaphone,
        href: event?.$id ? `/events/${event.$id}` : undefined,
        externalHref: !event?.$id ? conn.formUrl : undefined,
        searchText: normalizeSearchText([
          title,
          conn.title,
          event?.reference,
          event?.description,
          "opportunity",
          "volunteer",
        ]),
      });
    }

    const opportunityEventIds = new Set(
      opportunityList.map(({ event }) => event?.$id).filter(Boolean) as string[],
    );

    for (const event of events) {
      if (opportunityEventIds.has(event.$id)) {
        continue;
      }
      items.push({
        id: `event-${event.$id}`,
        group: "Events",
        label: event.title,
        subtitle: event.reference,
        icon: CalendarDays,
        href: `/events/${event.$id}`,
        searchText: normalizeSearchText([
          event.title,
          event.reference,
          event.description,
          event.status,
          String(event.year),
          event.term,
        ]),
      });
    }

    return items;
  }, [events, onCustomize, opportunityList, user.isAdmin]);

  const filteredItems = useMemo(
    () => allItems.filter((item) => itemMatchesQuery(item, query)),
    [allItems, query],
  );

  const safeHighlightIndex = Math.min(
    highlightIndex,
    Math.max(0, filteredItems.length - 1),
  );

  const close = useCallback(() => {
    setQuery("");
    setHighlightIndex(0);
    onOpenChange(false);
  }, [onOpenChange]);

  const runItem = useCallback(
    (item: CommandItem) => {
      close();
      if (item.onSelect) {
        item.onSelect();
        return;
      }
      if (item.externalHref) {
        window.open(item.externalHref, "_blank", "noopener,noreferrer");
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [close, router],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % Math.max(filteredItems.length, 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((prev) => {
          const len = filteredItems.length;
          if (len === 0) {
            return 0;
          }
          return (prev - 1 + len) % len;
        });
        return;
      }
      if (event.key === "Enter" && filteredItems[safeHighlightIndex]) {
        event.preventDefault();
        runItem(filteredItems[safeHighlightIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, filteredItems, open, runItem, safeHighlightIndex]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-command-index="${safeHighlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeHighlightIndex, filteredItems.length]);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!open || !mounted) {
    return null;
  }

  const grouped = filteredItems.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {});

  let flatIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[min(12vh,6rem)] sm:pt-24">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-hidden
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay shadow-overlay"
      >
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 h-12">
          <Search className="size-4 shrink-0 text-text-placeholder" aria-hidden />
          <input
            ref={inputRef}
            id="dashboard-command-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIndex(0);
            }}
            placeholder="Search or type a command"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text-body placeholder:text-text-placeholder focus:outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-border-subtle bg-bg-base px-2 py-0.5 text-[11px] text-text-placeholder">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-text-muted">No results match your search.</p>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const Icon = item.icon;
                    const active = index === safeHighlightIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-command-index={index}
                          onMouseEnter={() => setHighlightIndex(index)}
                          onClick={() => runItem(item)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                            active ? "bg-primary-soft text-primary" : "text-text-body hover:bg-bg-base"
                          }`}
                        >
                          <Icon
                            className={`size-4 shrink-0 ${active ? "text-primary" : "text-text-muted"}`}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{item.label}</span>
                            {item.subtitle ? (
                              <span
                                className={`block truncate text-[12px] ${active ? "text-primary/80" : "text-text-muted"}`}
                              >
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function isCommandPaletteShortcut(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
    return false;
  }
  return event.code === "KeyF" || event.key.toLowerCase() === "f";
}

export function useDashboardCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onOpen();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onOpen]);
}

export function usePrefersMacModifierKey() {
  return useSyncExternalStore(
    emptySubscribe,
    () => (typeof navigator !== "undefined" && !/Mac|iPhone|iPod|iPad/i.test(navigator.userAgent) ? "Ctrl" : "⌘"),
    () => "⌘",
  );
}
