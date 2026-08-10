"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

export function VerifyUomBanner() {
  const { user } = useDashboardData();

  if (user.profile.uomVerified) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-strong">Verify your UoM email</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-body">
            Complete verification to access volunteer forms and event participation.
          </p>
        </div>
      </div>
      <Link
        href="/verify-uom"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-warning px-3.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        Verify now
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
