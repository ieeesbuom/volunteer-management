"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar, MoreHorizontal, ArrowRight } from "lucide-react";
import { getEventRoleDisplayName } from "@/features/access-control/lib/rules";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

export function ScheduleWidget() {
  const { user } = useDashboardData();

  const currentWeekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    const days = [];
    const dayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        label: dayLabels[i],
        dateNum: d.getDate(),
        isToday: d.toDateString() === now.toDateString(),
      });
    }

    return days;
  }, []);

  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const found = currentWeekDays.findIndex((d) => d.isToday);
    return found !== -1 ? found : 0;
  });

  const dayAssignments = useMemo(() => {
    if (user.eventRoles.length === 0) return [];
    // Show assigned roles mapped cleanly across the days
    return user.eventRoles.filter((_, idx) => idx % 7 === selectedDayIndex % user.eventRoles.length || user.eventRoles.length <= 2);
  }, [user.eventRoles, selectedDayIndex]);

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success border border-success/20">
            <Calendar className="size-4.5" />
          </div>
          <h2 className="text-[16px] font-bold text-text-strong">Schedule</h2>
        </div>

        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full bg-bg-base border border-border-subtle px-3.5 py-1 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
        >
          View Calendar
        </Link>
      </div>

      {/* Week Day Selector */}
      <div className="grid grid-cols-7 gap-1 rounded-xl bg-bg-base border border-border-subtle p-1.5 text-center my-3 shrink-0">
        {currentWeekDays.map((day, idx) => {
          const isSelected = selectedDayIndex === idx;
          return (
            <button
              key={day.label}
              type="button"
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? "bg-primary-soft text-primary font-bold border border-primary-mid"
                  : "text-text-muted font-normal hover:bg-surface-raised text-[11px]"
              }`}
            >
              <span className="text-[11px] font-normal">{day.label}</span>
              <span className="text-[12px] font-bold mt-0.5">{day.dateNum}</span>
            </button>
          );
        })}
      </div>

      {/* Responsibilities for Selected Day */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5">
        {dayAssignments.length > 0 ? (
          dayAssignments.map((assignment, idx) => {
            const barColors = ["bg-success", "bg-primary", "bg-fuchsia-600"];
            const barColor = barColors[idx % barColors.length];
            const avatarBgs = [
              ["bg-warning", "bg-primary"],
              ["bg-danger", "bg-indigo-500"],
              ["bg-success", "bg-purple-600"],
            ];
            const pair = avatarBgs[idx % avatarBgs.length];

            return (
              <div
                key={assignment.$id}
                className="flex items-center justify-between gap-3 py-3 px-3.5 rounded-xl border border-border-subtle bg-bg-base/50 hover:bg-bg-base transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-1 h-10 rounded-full shrink-0 ${barColor}`} />
                  <div className="min-w-0">
                    <Link
                      href={`/events/${assignment.eventId}`}
                      className="font-semibold text-[13px] sm:text-[14px] text-text-strong hover:text-primary transition-colors truncate block cursor-pointer"
                    >
                      {assignment.eventTitle}
                    </Link>
                    <p className="text-[12px] text-text-muted font-normal mt-0.5">
                      {getEventRoleDisplayName(assignment.role, {
                        chairCount: assignment.eventChairCount ?? 0,
                      })}{" "}
                      • {assignment.committeeName ?? "Event-level"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex -space-x-2 overflow-hidden">
                    <div
                      className={`size-6 rounded-full ring-2 ring-white ${pair[0]} text-[10px] font-bold text-white flex items-center justify-center`}
                    >
                      {user.authUser.name ? user.authUser.name.charAt(0) : "V"}
                    </div>
                    <div
                      className={`size-6 rounded-full ring-2 ring-white ${pair[1]} text-[10px] font-bold text-white flex items-center justify-center`}
                    >
                      SB
                    </div>
                  </div>
                  <Link
                    href={`/events/${assignment.eventId}`}
                    className="p-1 text-text-placeholder hover:text-text-strong transition-colors cursor-pointer"
                    title="View Event Details"
                  >
                    <MoreHorizontal className="size-4" />
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center rounded-xl border border-dashed border-border-subtle bg-bg-base">
            <p className="text-[13px] font-medium text-text-muted">
              No specific responsibilities scheduled for {currentWeekDays[selectedDayIndex]?.label}.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline mt-2 cursor-pointer"
            >
              View All Events <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
