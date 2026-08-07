"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ListTodo,
  Users,
  CircleDot,
  Box,
  ExternalLink,
  MessageSquare,
  Paperclip,
  CalendarDays,
  ArrowRight,
  Check,
} from "lucide-react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";
import { Badge } from "@/components/ui/badge";
import {
  formatEventStatus,
  getEventStatusBadgeTone,
} from "@/features/events/lib/event-ui";

type TimeframeFilter = "This Week" | "This Month" | "All Time";

export function MyProjectsWidget() {
  const { opportunityList } = useDashboardData();
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("This Week");
  const [dropdownOpen, setDrawerOpen] = useState(false);

  const filteredOpportunities = useMemo(() => {
    if (timeframe === "This Week") {
      return opportunityList.slice(0, 3);
    }
    if (timeframe === "This Month") {
      return opportunityList.slice(0, 5);
    }
    return opportunityList;
  }, [opportunityList, timeframe]);

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6 flex flex-col overflow-hidden">
      {/* Widget Header */}
      <div className="flex items-center justify-between gap-3 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary border border-primary-mid shrink-0">
            <ListTodo className="size-4.5" />
          </div>
          <h2 className="text-[15px] sm:text-[16px] font-bold text-text-strong truncate">My Projects</h2>

          {/* Timeframe Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-base px-2.5 py-1 text-[12px] font-medium text-text-body hover:bg-neutral-soft transition-colors cursor-pointer"
            >
              <span>{timeframe}</span>
              <ChevronDown className={`size-3.5 text-text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-36 rounded-xl border border-border-subtle bg-surface-raised p-1.5 shadow-lg text-[12px]">
                {(["This Week", "This Month", "All Time"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setTimeframe(option);
                      setDrawerOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                      timeframe === option
                        ? "bg-primary-soft text-primary font-bold"
                        : "text-text-body hover:bg-bg-base"
                    }`}
                  >
                    <span>{option}</span>
                    {timeframe === option && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full bg-bg-base border border-border-subtle px-3.5 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer shrink-0"
        >
          See All
        </Link>
      </div>

      {/* Table Container - Enable smooth horizontal & vertical scrolling */}
      <div className="flex-1 min-h-0 overflow-auto mt-1">
        {filteredOpportunities.length > 0 ? (
          <div className="border border-border-subtle rounded-2xl overflow-x-auto bg-surface-raised">
            <table className="w-full text-left text-[12px] sm:text-[13px] border-collapse min-w-[580px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-border-subtle text-[11px] sm:text-[12px] font-semibold text-[#475569]">
                  <th className="py-2.5 px-3.5 sm:px-4">
                    <span className="flex items-center gap-1.5">
                      <Box className="size-3.5 text-blue-600" />
                      Task Name
                    </span>
                  </th>
                  <th className="py-2.5 px-3.5 sm:px-4">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-blue-600" />
                      Assign
                    </span>
                  </th>
                  <th className="py-2.5 px-3.5 sm:px-4 text-right">
                    <span className="flex items-center gap-1.5 justify-end">
                      <CircleDot className="size-3.5 text-amber-500" />
                      Status
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/80 bg-surface-raised">
                {filteredOpportunities.map(({ conn, event }, idx) => {
                  const avatarBgs = [
                    "bg-[#92400e]",
                    "bg-[#1e40af]",
                    "bg-[#7e22ce]",
                    "bg-[#047857]",
                    "bg-[#be123c]",
                  ];
                  const avatarBg = avatarBgs[idx % avatarBgs.length];

                  return (
                    <tr
                      key={conn.id}
                      className="hover:bg-[#f8fafc] transition-colors"
                    >
                      {/* Task Name Column */}
                      <td className="py-3 px-3.5 sm:px-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Box className="size-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-text-strong text-[13px] sm:text-[14px] truncate max-w-[200px] sm:max-w-xs" title={event?.title || conn.title}>
                            {event?.title || conn.title}
                          </span>

                          <div className="hidden md:flex items-center gap-1.5 text-[10px] sm:text-[11px] shrink-0 font-medium ml-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/80 px-2 py-0.5">
                              <MessageSquare className="size-2.5 text-fuchsia-600" />
                              T{event?.term || "2025/2026"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5">
                              <Paperclip className="size-2.5 text-blue-600" />
                              {event?.year || "2025"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Assign Column */}
                      <td className="py-3 px-3.5 sm:px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex size-6 items-center justify-center rounded-full ${avatarBg} text-[10px] font-bold text-white shrink-0`}
                          >
                            {conn.title.charAt(0).toUpperCase()}
                          </div>
                          <a
                            href={conn.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-text-strong text-[12px] sm:text-[13px] hover:text-primary transition-colors inline-flex items-center gap-1 group cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
                            title={conn.title}
                          >
                            <span className="truncate">{conn.title}</span>
                            <ExternalLink className="size-3 text-text-placeholder group-hover:text-blue-600 transition-colors shrink-0" />
                          </a>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3 px-3.5 sm:px-4 text-right">
                        {event ? (
                          <Badge
                            tone={getEventStatusBadgeTone(event.status)}
                            className="text-[11px] whitespace-nowrap"
                          >
                            {formatEventStatus(event.status)}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[11px] whitespace-nowrap">
                            Open
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border-subtle bg-[#f8fafc]">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-2.5">
              <CalendarDays className="size-5" />
            </div>
            <p className="text-[14px] font-semibold text-text-strong">
              No Open Volunteer Opportunities
            </p>
            <p className="text-[12px] text-text-muted mt-1 max-w-md mx-auto">
              There are currently no open volunteer registration forms for upcoming events.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline mt-3 cursor-pointer"
            >
              Browse Event Directory <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
