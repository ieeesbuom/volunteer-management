"use client";

import Link from "next/link";
import { CalendarDays, Trophy, UserRound, ArrowRight } from "lucide-react";

const links = [
  { href: "/events", label: "Events directory", icon: CalendarDays },
  { href: "/scoring", label: "Leaderboard", icon: Trophy },
  { href: "/volunteers/me", label: "Your profile", icon: UserRound },
] as const;

export function QuickLinksWidget() {
  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-5 flex flex-col">
      <h2 className="text-[15px] font-semibold text-text-strong mb-3">Quick links</h2>
      <ul className="space-y-2 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-base px-3 py-2.5 text-[13px] font-medium text-text-body hover:bg-primary-soft hover:border-primary-mid transition-colors cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                {label}
              </span>
              <ArrowRight className="size-3.5 text-text-placeholder group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
