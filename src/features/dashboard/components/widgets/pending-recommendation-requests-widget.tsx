"use client";

import { AppLink } from "@/components/layout/app-link";
import { ArrowRight, MessageSquareQuote } from "lucide-react";

export type PendingRecommendationRequestPreview = {
  $id: string;
  requesterName: string;
};

export function PendingRecommendationRequestsWidget({
  requests,
}: {
  requests: PendingRecommendationRequestPreview[];
}) {
  if (requests.length === 0) {
    return null;
  }

  const names = requests.map((request) => request.requesterName);
  const preview =
    names.length <= 2
      ? names.join(" and ")
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <MessageSquareQuote className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text-strong">
            {requests.length === 1
              ? "Recommendation request waiting"
              : `${requests.length} recommendation requests waiting`}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-body">
            {requests.length === 1
              ? `${preview} asked you to write a recommendation.`
              : `${preview} asked you to write recommendations.`}
          </p>
        </div>
      </div>
      <AppLink
        href="/volunteers/me"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        Respond
        <ArrowRight className="size-3.5" aria-hidden />
      </AppLink>
    </div>
  );
}
