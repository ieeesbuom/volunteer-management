"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isSafeNotificationLink } from "@/lib/validation/safe-links";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  linkHref?: string;
};

export function NotificationsSummaryWidget() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/notifications?limit=5");
        const data = (await res.json()) as {
          notifications?: NotificationRow[];
          unreadCount?: number;
          error?: string;
        };

        if (!res.ok) {
          if (!cancelled) {
            setError(data.error ?? "Could not load notifications.");
            setItems([]);
            setUnreadCount(0);
          }
          return;
        }

        if (!cancelled) {
          setError(null);
          setItems(data.notifications ?? []);
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load notifications.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markRead(notificationId: string) {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      setItems((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // Keep list usable even if mark-read fails.
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-primary" aria-hidden />
          <h2 className="text-[15px] font-semibold text-text-strong">Notifications</h2>
          {unreadCount > 0 ? (
            <Badge tone="primary" className="text-[11px] font-semibold">
              {unreadCount} unread
            </Badge>
          ) : null}
        </div>
        <Link
          href="/dashboard?tab=notifications"
          className="text-[12px] font-semibold text-primary hover:underline"
          title="Open notification panel"
        >
          View all
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="py-2 text-[13px] text-danger">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-[13px] text-text-muted">You are all caught up.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const href =
                n.linkHref && isSafeNotificationLink(n.linkHref) ? n.linkHref : undefined;

              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-[12px] transition-colors hover:border-primary/40 ${
                      n.readAt
                        ? "border-border-subtle bg-bg-base text-text-muted"
                        : "border-primary-mid bg-primary-soft text-text-body"
                    }`}
                    onClick={() => {
                      if (!n.readAt) {
                        void markRead(n.id);
                      }
                      if (href) {
                        router.push(href);
                        return;
                      }
                      router.push("/dashboard?tab=notifications");
                    }}
                  >
                    <p className="truncate font-semibold text-text-strong">{n.title}</p>
                    <p className="mt-0.5 truncate">{n.message}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
