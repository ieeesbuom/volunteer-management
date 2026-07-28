"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecommendationWithRespondent } from "@/features/recommendations/types";

export function RecommendationList({
  canReport,
  initialRecommendations,
}: {
  canReport: boolean;
  initialRecommendations: RecommendationWithRespondent[];
}) {
  const [message, setMessage] = useState("");
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
  const [recommendations] = useState(initialRecommendations);

  async function reportRecommendation(recommendationId: string) {
    const reason = window.prompt("Why should this recommendation be reviewed?");

    if (reason === null) {
      return;
    }

    setPendingReport(recommendationId);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations/report", {
        body: JSON.stringify({ reason, recommendationId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Recommendation report failed.");
      }

      setReportedIds((current) =>
        current.includes(recommendationId) ? current : [...current, recommendationId],
      );
      setMessage("Recommendation reported for admin review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation report failed.");
    } finally {
      setPendingReport(null);
    }
  }

  return (
    <div className="space-y-3">
      {recommendations.length > 0 ? (
        recommendations.map((recommendation) => (
          <div
            key={recommendation.$id}
            className="rounded-md border border-border-subtle bg-surface pl-4 pr-4 pt-4 pb-3"
            style={{ borderLeft: "3px solid var(--primary)" }}
          >
            <p className="text-sm leading-relaxed text-text-primary italic">
              &ldquo;{recommendation.text}&rdquo;
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                From{" "}
                <span className="normal-case font-normal tracking-normal text-text-secondary">
                  {recommendation.respondent ? (
                    <Link
                      href={`/volunteers/${recommendation.respondentId}`}
                      className="hover:underline hover:text-primary transition-colors cursor-pointer"
                    >
                      {displayRespondent(recommendation)}
                    </Link>
                  ) : (
                    "Unknown volunteer"
                  )}
                </span>
              </p>
              {canReport ? (
                reportedIds.includes(recommendation.$id) ? (
                  <p className="text-xs text-text-muted">Reported for admin review</p>
                ) : (
                  <Button
                    disabled={pendingReport === recommendation.$id}
                    onClick={() => reportRecommendation(recommendation.$id)}
                    type="button"
                    variant="ghost"
                  >
                    <Flag className="size-3.5" aria-hidden="true" />
                    Report
                  </Button>
                )
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <p className="py-4 text-center text-sm text-text-muted">
          No recommendations have been written for this volunteer yet.
        </p>
      )}
      {message ? <p className="mt-2 text-sm text-text-secondary">{message}</p> : null}
    </div>
  );
}

function displayRespondent(recommendation: RecommendationWithRespondent) {
  const respondent = recommendation.respondent;

  if (!respondent) {
    return "Unknown volunteer";
  }

  return respondent.name || respondent.uomEmail || respondent.googleEmail || "Unknown volunteer";
}
