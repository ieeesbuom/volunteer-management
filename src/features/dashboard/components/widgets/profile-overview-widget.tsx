"use client";

import Link from "next/link";
import {
  FileText,
  Check,
  AlertCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/features/dashboard/components/dashboard-data-context";

export function ProfileOverviewWidget() {
  const { user } = useDashboardData();

  return (
    <div className="h-full rounded-2xl border border-border-subtle bg-surface-raised p-6 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-warning-soft text-warning border border-warning/20">
            <FileText className="size-4.5" />
          </div>
          <h2 className="text-[16px] font-bold text-text-strong">Profile Overview</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto mt-4 space-y-3.5">
        <div className="border-b border-dashed border-border-subtle pb-3.5">
          <div className="flex items-start gap-3">
            <div
              className={`size-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold ${
                user.profile.uomVerified
                  ? "bg-success text-white"
                  : "bg-warning-soft text-warning border border-warning/30"
              }`}
            >
              {user.profile.uomVerified ? (
                <Check className="size-3.5 stroke-3" />
              ) : (
                <AlertCircle className="size-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-text-strong">UoM Verification</p>
                {!user.profile.uomVerified && (
                  <Link
                    href="/volunteers/me"
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Verify Now
                  </Link>
                )}
              </div>
              <p className="text-[12px] text-text-muted font-normal mt-0.5 leading-relaxed">
                {user.profile.uomVerified
                  ? `Verified via ${user.profile.uomEmail}`
                  : "Verification required to earn volunteer points."}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-dashed border-border-subtle pb-3.5">
          <div className="flex items-start gap-3">
            <div className="size-6 rounded-full shrink-0 mt-0.5 bg-primary text-white flex items-center justify-center text-xs font-bold">
              <ShieldCheck className="size-3.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-strong">
                {user.isAdmin ? "Administrator Privilege" : "Volunteer Account"}
              </p>
              <p className="text-[12px] text-text-muted font-normal mt-0.5 leading-relaxed">
                Status:{" "}
                <Badge tone="success" className="align-middle text-[11px] font-semibold uppercase">
                  {user.profile.status}
                </Badge>{" "}
                • {user.isAdmin ? "Full admin authority" : "Standard volunteer access"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-dashed border-border-subtle pb-3.5">
          <div className="flex items-start gap-3">
            <div className="size-6 rounded-full shrink-0 mt-0.5 bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
              <UserCheck className="size-3.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-strong">Authenticated Account</p>
              <p className="text-[12px] text-text-muted font-normal mt-0.5 leading-relaxed break-all">
                {user.authUser.name || "Volunteer"} ({user.authUser.email})
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-start gap-3">
            <div className="size-6 rounded-full shrink-0 mt-0.5 bg-fuchsia-500 text-white flex items-center justify-center text-xs font-bold">
              <Check className="size-3.5 stroke-3" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text-strong">Student Branch Roles</p>
              <p className="text-[12px] text-text-muted font-normal mt-0.5 leading-relaxed">
                {user.sbRoles.length > 0
                  ? user.sbRoles.join(", ")
                  : "No executive SB roles assigned."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
