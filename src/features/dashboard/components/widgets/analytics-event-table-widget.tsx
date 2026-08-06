"use client";

import Link from "next/link";
import { BarChart3, CalendarDays } from "lucide-react";

type EventIntegrationRow = {
  id: string;
  name: string;
  category: string;
  rate: number;
  points: number;
  bgTag: string;
};

const SAMPLE_EVENTS: EventIntegrationRow[] = [
  {
    id: "e1",
    name: "IEEE Technoverse 2026",
    category: "Flagship Event",
    rate: 92,
    points: 1250,
    bgTag: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  },
  {
    id: "e2",
    name: "Annual Hackathon & Expo",
    category: "Competition",
    rate: 85,
    points: 980,
    bgTag: "bg-purple-50 text-purple-700 border-purple-200/80",
  },
  {
    id: "e3",
    name: "WIE Leadership Summit",
    category: "Workshop",
    rate: 78,
    points: 640,
    bgTag: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  },
  {
    id: "e4",
    name: "Community Outreach Drive",
    category: "CSR Drive",
    rate: 64,
    points: 420,
    bgTag: "bg-amber-50 text-amber-700 border-amber-200/80",
  },
];

export function AnalyticsEventTableWidget() {
  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:p-6 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary border border-primary-mid shrink-0">
            <BarChart3 className="size-4" />
          </div>
          <h2 className="text-[15px] sm:text-[16px] font-bold text-text-strong truncate">Recent Event Impact</h2>
        </div>
        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full bg-bg-base border border-border-subtle px-3.5 py-1.5 text-[12px] font-semibold text-text-body hover:bg-neutral-soft transition-colors cursor-pointer shrink-0"
        >
          See All
        </Link>
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0 overflow-auto mt-1">
        <div className="border border-border-subtle rounded-2xl overflow-x-auto bg-surface-raised">
          <table className="w-full text-left text-[12px] sm:text-[13px] border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-border-subtle text-[11px] sm:text-[12px] font-semibold text-[#475569]">
                <th className="py-2.5 px-3.5 sm:px-4">Event</th>
                <th className="py-2.5 px-3.5 sm:px-4">Category</th>
                <th className="py-2.5 px-3.5 sm:px-4">Completion Progress</th>
                <th className="py-2.5 px-3.5 sm:px-4 text-right">Points Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/80 bg-surface-raised">
              {SAMPLE_EVENTS.map((event) => (
                <tr key={event.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="py-3 px-3.5 sm:px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                        <CalendarDays className="size-3.5" />
                      </div>
                      <span className="font-bold text-text-strong text-[13px] truncate max-w-[160px] sm:max-w-xs">
                        {event.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 sm:px-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold border whitespace-nowrap ${event.bgTag}`}
                    >
                      {event.category}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 sm:px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-2 flex-1 rounded-full bg-bg-base border border-border-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${event.rate}%` }}
                        />
                      </div>
                      <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full text-[11px] tabular-nums shrink-0">
                        {event.rate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 sm:px-4 text-right">
                    <span className="font-extrabold text-text-strong tabular-nums text-[13px] whitespace-nowrap">
                      +{event.points} pts
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
