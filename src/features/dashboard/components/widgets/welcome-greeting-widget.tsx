"use client";

import { Calendar } from "lucide-react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

export function WelcomeGreetingWidget() {
  const { user } = useDashboardData();

  const firstName = user.authUser.name?.split(" ")[0] || "Volunteer";

  const greetingTime = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning!";
    if (hour < 18) return "Good Afternoon!";
    return "Good Evening!";
  })();

  const todayFormatted = (() => {
    const now = new Date();
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const dayNum = now.getDate();
    const monthName = now.toLocaleDateString("en-US", { month: "long" });
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    return `${dayName}, ${getOrdinal(dayNum)} ${monthName}`;
  })();

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised px-6 py-4 flex items-center justify-between gap-4 overflow-hidden">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 text-[12px] font-medium text-text-muted">
          <Calendar className="size-3.5 text-primary" />
          <span>{todayFormatted}</span>
        </div>
        <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-text-strong truncate">
          {greetingTime} {firstName},
        </h1>
      </div>

      <div
        className="hidden sm:flex shrink-0 flex-col items-end gap-1 border-l border-border-subtle pl-5"
        aria-label="IEEE Student Branch University of Moratuwa Volunteer Portal"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          IEEE SB · UoM
        </span>
        <span className="text-[13px] font-medium text-text-body">Volunteer portal</span>
      </div>
    </div>
  );
}
