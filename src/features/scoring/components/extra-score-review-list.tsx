"use client";

import { ChevronDown } from "lucide-react";
import { volunteerInitials } from "@/components/leaderboard/leaderboard-table-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GradeRequest } from "../types";
type DashboardRole = "Admin" | "Chairperson" | "Committee Lead" | "Member";

function ExtraScorePill({ value }: { value: number | null | undefined }) {
  const hasScore = value !== undefined && value !== null;

  return (
    <div
      className={cn(
        "inline-flex min-w-[4.5rem] flex-col items-center rounded-xl border px-4 py-2 text-center",
        hasScore ? "border-primary/20 bg-primary-soft" : "border-border-subtle bg-neutral-soft",
      )}
    >
      <span
        className={cn(
          "text-[22px] font-bold tabular-nums leading-none",
          hasScore ? "text-primary" : "text-text-muted",
        )}
      >
        {hasScore ? value : "—"}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">out of 10</span>
    </div>
  );
}

export function ExtraScoreReviewList({
  authUserId,
  chairEventIds,
  derivedRole,
  isAdmin,
  onApprove,
  onReject,
  onScoreSaved,
  onError,
  onSuccess,
  requests,
  volunteerLabel,
}: Readonly<{
  authUserId: string;
  chairEventIds: string[];
  derivedRole: DashboardRole;
  isAdmin: boolean;
  onApprove: (req: GradeRequest) => void;
  onReject: (req: GradeRequest) => void;
  onScoreSaved: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  requests: GradeRequest[];
  volunteerLabel: (userId: string) => string;
}>) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-base/30 py-14 text-center text-[13px] text-text-muted">
        No extra score requests need review right now.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-surface-raised">
      {requests.map((req) => {
        const targetVolName = req.targetUserName ?? volunteerLabel(req.targetUserId);
        const canSubmitScoreForEvent = chairEventIds.includes(req.eventId) || isAdmin;
        const showEditSection =
          (isAdmin || canSubmitScoreForEvent) && req.status !== "finalized";
        const showAdminActions = isAdmin && req.status !== "finalized";

        const scoreEditForm = (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const val = Number(formData.get("gradeValue"));
              try {
                const res = await fetch(`/api/scoring/grade-requests/${req.$id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ gradeValue: val }),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                onSuccess("Extra score updated successfully!");
                onScoreSaved();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Failed to update extra score.");
              }
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="w-24">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                New score
              </label>
              <input
                type="number"
                name="gradeValue"
                min={0}
                max={10}
                defaultValue={
                  req.gradeValue !== undefined && req.gradeValue !== null ? req.gradeValue : ""
                }
                required
                className="h-[38px] w-full rounded-md border border-border bg-surface px-3 text-sm tabular-nums"
              />
            </div>
            <Button type="submit" variant="secondary" className="cursor-pointer">
              Save
            </Button>
          </form>
        );

        return (
          <li key={req.$id} className="px-4 py-5 sm:px-5 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <span
                  aria-hidden
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary-soft text-[13px] font-bold text-primary"
                >
                  {volunteerInitials(targetVolName)}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[15px] font-semibold text-text-strong">{targetVolName}</p>
                  <p className="truncate text-[13px] text-text-muted">{req.eventTitle}</p>
                  {showAdminActions ? (
                    <p className="pt-1 text-[12px] text-text-muted">Awaiting admin finalization</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:justify-end lg:gap-6">
                <ExtraScorePill value={req.gradeValue} />

                {showAdminActions ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      className="cursor-pointer"
                      onClick={() => onApprove(req)}
                      type="button"
                    >
                      Finalize
                    </Button>
                    <Button
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => onReject(req)}
                      type="button"
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            {showEditSection ? (
              <div className="mt-5 border-t border-border-subtle pt-5">
                {req.targetUserId === authUserId ? (
                  <p className="rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-warning">
                    You cannot grade yourself.
                  </p>
                ) : !canSubmitScoreForEvent ? (
                  <p className="rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-warning">
                    You must be the event chair or an admin to submit or update extra scores.
                  </p>
                ) : derivedRole === "Admin" ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                      Adjust score before finalizing
                    </summary>
                    <div className="mt-4">{scoreEditForm}</div>
                  </details>
                ) : (
                  scoreEditForm
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
