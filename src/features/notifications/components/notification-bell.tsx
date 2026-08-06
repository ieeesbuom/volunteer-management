"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isSafeNotificationLink } from "@/lib/validation/safe-links";
import { cn } from "@/lib/utils";
import type { Notification } from "@/features/notifications/types";

type NotificationBellProps = {
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
  /** Open the dropdown once after mount (e.g. `/dashboard?tab=notifications`). */
  autoOpen?: boolean;
};

type NotificationPayload = {
  notifications: Notification[];
  unreadCount: number;
};

const emptySubscribe = () => () => {};

const DROPDOWN_WIDTH = 416;
const DROPDOWN_MAX_HEIGHT = 480;
const VIEWPORT_GAP = 8;

export function NotificationBell({
  initialNotifications = [],
  initialUnreadCount = 0,
  autoOpen = false,
}: NotificationBellProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const didAutoOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pendingReadIds, setPendingReadIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const unreadNotificationIds = useMemo(
    () =>
      notifications
        .filter((notification) => !notification.readAt)
        .map((notification) => notification.id),
    [notifications],
  );

  const updateDropdownPosition = useCallback(function updateDropdownPosition() {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GAP;
    const spaceAbove = rect.top - VIEWPORT_GAP;
    const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      DROPDOWN_MAX_HEIGHT,
      Math.max(180, openUpward ? spaceAbove : spaceBelow),
    );

    let left = rect.right - width;
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP));

    setDropdownStyle({
      position: "fixed",
      top: openUpward ? undefined : rect.bottom + VIEWPORT_GAP,
      bottom: openUpward ? window.innerHeight - rect.top + VIEWPORT_GAP : undefined,
      left,
      width,
      maxHeight,
      zIndex: 80,
    });
  }, []);

  const refreshNotifications = useCallback(async function refreshNotifications() {
    setIsRefreshing(true);
    setMessage("");

    try {
      const response = await fetch("/api/notifications?limit=15");
      const payload = (await response.json()) as NotificationPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not refresh notifications.");
        return;
      }

      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch {
      setMessage("Could not refresh notifications.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshNotifications]);

  useEffect(() => {
    if (!autoOpen || didAutoOpenRef.current) {
      return;
    }
    didAutoOpenRef.current = true;
    setIsOpen(true);
    updateDropdownPosition();
    void refreshNotifications();
  }, [autoOpen, refreshNotifications, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handleReposition() {
      updateDropdownPosition();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  async function markRead(notificationIds: string[]) {
    if (notificationIds.length === 0) {
      return;
    }

    setPendingReadIds(notificationIds);
    setMessage("");

    try {
      const response = await fetch("/api/notifications/mark-read", {
        body: JSON.stringify({ notificationIds }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        notifications?: Notification[];
      };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not update notifications.");
        return;
      }

      const updatedById = new Map(
        (payload.notifications ?? []).map((notification) => [
          notification.id,
          notification,
        ]),
      );

      setNotifications((current) =>
        current.map((notification) => updatedById.get(notification.id) ?? notification),
      );
      setUnreadCount((current) =>
        Math.max(
          0,
          current -
            notificationIds.filter((id) =>
              notifications.some(
                (notification) => notification.id === id && !notification.readAt,
              ),
            ).length,
        ),
      );
    } catch {
      setMessage("Could not update notifications.");
    } finally {
      setPendingReadIds([]);
    }
  }

  function toggleOpen() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      updateDropdownPosition();
      void refreshNotifications();
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className="relative flex size-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-neutral-soft hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        onClick={toggleOpen}
        type="button"
      >
        <Bell className="size-5" aria-hidden="true" />
        <UnreadCountBadge count={unreadCount} />
      </button>

      {isOpen && mounted
        ? createPortal(
            <div
              ref={dropdownRef}
              className="overflow-hidden rounded-[12px] border border-border-subtle bg-surface text-text-primary shadow-overlay origin-top-right animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-label="Notifications"
              style={dropdownStyle}
            >
              <NotificationDropdown
                isRefreshing={isRefreshing}
                message={message}
                notifications={notifications}
                onMarkAllRead={() => markRead(unreadNotificationIds)}
                onMarkRead={(notificationId) => markRead([notificationId])}
                onRefresh={refreshNotifications}
                pendingReadIds={pendingReadIds}
                unreadCount={unreadCount}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function UnreadCountBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold leading-none text-white animate-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationDropdown({
  isRefreshing,
  message,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onRefresh,
  pendingReadIds,
  unreadCount,
}: {
  isRefreshing: boolean;
  message: string;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkRead: (notificationId: string) => void;
  onRefresh: () => Promise<void>;
  pendingReadIds: string[];
  unreadCount: number;
}) {
  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 shrink-0">
        <div>
          <p className="text-[14px] font-semibold text-text-strong">Notifications</p>
          <p className="text-[12px] text-text-muted">{unreadCount} unread</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-8 px-2.5 text-xs"
            disabled={unreadCount === 0 || pendingReadIds.length > 0}
            onClick={onMarkAllRead}
            type="button"
            variant="ghost"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Mark all
          </Button>
          <button
            aria-label="Refresh notifications"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary cursor-pointer"
            disabled={isRefreshing}
            onClick={() => void onRefresh()}
            type="button"
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Inbox className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {message ? (
        <p className="border-b border-danger/20 bg-danger-soft px-4 py-2 text-sm text-danger shrink-0">
          {message}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotificationList
          notifications={notifications}
          onMarkRead={onMarkRead}
          pendingReadIds={pendingReadIds}
        />
      </div>
    </div>
  );
}

export function NotificationList({
  notifications,
  onMarkRead,
  pendingReadIds,
}: {
  notifications: Notification[];
  onMarkRead: (notificationId: string) => void;
  pendingReadIds: string[];
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted mb-4">
          <Inbox className="size-6 text-text-muted" aria-hidden="true" />
        </div>
        <p className="text-[15px] font-semibold text-text-strong">You&apos;re all caught up.</p>
        <p className="mt-1 text-[13px] text-text-secondary">Check back later for updates.</p>
      </div>
    );
  }

  return (
    <div>
      {notifications.map((notification) => (
        <NotificationListItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
          pending={pendingReadIds.includes(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationListItem({
  notification,
  onMarkRead,
  pending,
}: {
  notification: Notification;
  onMarkRead: (notificationId: string) => void;
  pending: boolean;
}) {
  const linkHref =
    notification.linkHref && isSafeNotificationLink(notification.linkHref)
      ? notification.linkHref
      : undefined;

  async function handleActivate() {
    if (!notification.readAt) {
      onMarkRead(notification.id);
    }
  }

  const mainContent = (
    <div className={linkHref ? "block" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
            <NotificationReadState readAt={notification.readAt} />
          </div>
          <p className="mt-1 text-sm leading-5 text-text-secondary">{notification.message}</p>
        </div>
        {linkHref ? (
          <ExternalLink className="mt-1 size-4 shrink-0 text-text-muted" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={notificationItemClasses(!notification.readAt)}>
      {linkHref ? (
        <Link
          href={linkHref}
          onClick={() => {
            void handleActivate();
          }}
        >
          {mainContent}
        </Link>
      ) : (
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          onClick={() => {
            void handleActivate();
          }}
        >
          {mainContent}
        </button>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>{new Date(notification.createdAt).toLocaleString()}</span>
        {!notification.readAt ? (
          <button
            className="font-medium text-primary hover:text-primary-hover cursor-pointer"
            disabled={pending}
            onClick={() => onMarkRead(notification.id)}
            type="button"
          >
            {pending ? "Saving" : "Mark read"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationReadState({ readAt }: { readAt: string | null }) {
  return (
    <Badge className="h-6 px-2 text-[11px]" tone={readAt ? "neutral" : "primary"}>
      {readAt ? "Read" : "Unread"}
    </Badge>
  );
}

function notificationItemClasses(unread: boolean) {
  return cn(
    "border-b border-border-subtle px-4 py-3 text-left transition-colors last:border-0 hover:bg-neutral-soft",
    unread
      ? "bg-primary-soft border-l-[3px] border-l-primary"
      : "bg-surface border-l-[3px] border-l-transparent",
  );
}
