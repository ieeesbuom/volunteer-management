"use client";

import { useEffect, useState } from "react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatToday(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function WelcomeGreetingWidget() {
  const { user } = useDashboardData();
  const firstName = user.authUser.name?.split(" ")[0] || "Volunteer";

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());

    // Refresh at least once a minute so greeting flips at noon / evening
    // while the page stays open, and when the tab becomes visible again.
    const intervalId = window.setInterval(tick, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const greeting = getGreeting(now.getHours());

  return (
    <header className="min-w-0 py-1">
      <p className="text-[12px] font-medium text-text-muted">{formatToday(now)}</p>
      <h1 className="mt-1 truncate text-[24px] font-bold tracking-tight text-text-strong sm:text-[28px]">
        {greeting}, {firstName}
      </h1>
    </header>
  );
}
