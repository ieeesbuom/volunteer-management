"use client";

import { Eye, LogOut } from "lucide-react";
import { useViewMode } from "@/features/access-control/components/view-mode-context";

export function VolunteerPreviewBanner() {
  const { isVolunteerPreview, setViewMode } = useViewMode();

  if (!isVolunteerPreview) {
    return null;
  }

  return (
    <aside
      aria-label="Volunteer preview mode indicator"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/20 bg-warning-soft px-4 py-2 text-warning transition-colors sm:px-6"
    >
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-warning">
        <Eye className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Volunteer Preview Mode:</strong> Viewing as a standard volunteer. Administration tools are hidden.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setViewMode("admin")}
        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-warning/30 bg-surface-raised px-3 text-[12px] font-semibold text-warning shadow-sm transition-all hover:bg-surface-raised/80 hover:shadow active:translate-y-px"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        Exit Preview
      </button>
    </aside>
  );
}
