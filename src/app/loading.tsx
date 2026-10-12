import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/60 backdrop-blur-xs"
    >
      <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-raised px-4 py-2.5 shadow-md">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        <span className="text-[13px] font-medium text-text-muted">Loading…</span>
      </div>
    </div>
  );
}
