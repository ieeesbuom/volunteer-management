"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTableHead, DataTableShell } from "@/components/ui/data-table";
import type {
  RecommendationRequestStatus,
  RecommendationRequestWithProfiles,
} from "@/features/recommendations/types";

type RequestsState = {
  incoming: RecommendationRequestWithProfiles[];
  outgoing: RecommendationRequestWithProfiles[];
};

const statusLabel: Record<RecommendationRequestStatus, string> = {
  ACCEPTED: "Accepted",
  PENDING: "Pending",
  REJECTED: "Rejected",
};

export function RecommendationRequestsPanel({
  initialRequests,
}: {
  initialRequests: RequestsState;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [requests, setRequests] = useState(initialRequests);

  async function respondToRequest({
    requestId,
    response,
  }: {
    requestId: string;
    response: "ACCEPTED" | "REJECTED";
  }) {
    setPendingAction(`${requestId}:${response}`);
    setMessage("");

    try {
      const apiResponse = await fetch("/api/recommendations/respond", {
        body: JSON.stringify({
          requestId,
          response,
          text: drafts[requestId] ?? "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(result.error ?? "Recommendation response failed.");
      }

      setRequests((current) => ({
        ...current,
        incoming: current.incoming.map((request) =>
          request.$id === requestId
            ? {
                ...request,
                respondedAt: result.request.respondedAt,
                status: result.request.status,
              }
            : request,
        ),
      }));
      setDrafts((current) => ({ ...current, [requestId]: "" }));
      setMessage(response === "ACCEPTED" ? "Recommendation submitted." : "Request rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation response failed.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-text-strong">Incoming requests</h3>
        {requests.incoming.length > 0 ? (
          <div className="space-y-3">
            {requests.incoming.map((request) => (
              <div
                className="rounded-2xl border border-border-subtle bg-surface-raised p-4"
                key={request.$id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-text-strong">
                      {request.requester ? (
                        <Link
                          href={`/volunteers/${request.requesterId}`}
                          className="cursor-pointer transition-colors hover:text-primary"
                        >
                          {displayName(request.requester)}
                        </Link>
                      ) : (
                        "Unknown volunteer"
                      )}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                      {request.message || "No message provided."}
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-text-muted">
                    {statusLabel[request.status]}
                  </span>
                </div>
                {request.status === "PENDING" ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      className="min-h-24 w-full resize-y rounded-xl border border-border-subtle bg-bg-base px-3 py-2 text-[13px] text-text-strong outline-none transition-colors placeholder:text-text-placeholder focus:border-primary focus:shadow-[0_0_0_3px_hsl(216_79%_36%/0.12)]"
                      maxLength={2000}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [request.$id]: event.target.value,
                        }))
                      }
                      placeholder="Write the recommendation before accepting."
                      value={drafts[request.$id] ?? ""}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={pendingAction === `${request.$id}:ACCEPTED`}
                        onClick={() =>
                          respondToRequest({
                            requestId: request.$id,
                            response: "ACCEPTED",
                          })
                        }
                        type="button"
                      >
                        <Check className="size-4" aria-hidden="true" />
                        Accept and write
                      </Button>
                      <Button
                        disabled={pendingAction === `${request.$id}:REJECTED`}
                        onClick={() =>
                          respondToRequest({
                            requestId: request.$id,
                            response: "REJECTED",
                          })
                        }
                        type="button"
                        variant="ghost"
                      >
                        <X className="size-4" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-text-muted">No incoming recommendation requests.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-text-strong">Outgoing requests</h3>
        {requests.outgoing.length > 0 ? (
          <DataTableShell minWidth={420}>
            <colgroup>
              <col />
              <col className="w-[120px]" />
            </colgroup>
            <DataTableHead
              columns={[
                { label: "Volunteer" },
                { label: "Status", align: "right" },
              ]}
            />
            <tbody>
              {requests.outgoing.map((request) => (
                <tr
                  key={request.$id}
                  className="border-b border-border-subtle last:border-b-0 hover:bg-bg-base/50"
                >
                  <td className="px-4 py-3.5 text-[13px] font-medium text-text-strong">
                    {request.respondent ? (
                      <Link
                        href={`/volunteers/${request.respondentId}`}
                        className="cursor-pointer transition-colors hover:text-primary"
                      >
                        {displayName(request.respondent)}
                      </Link>
                    ) : (
                      "Unknown volunteer"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[13px] text-text-muted">
                    {statusLabel[request.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTableShell>
        ) : (
          <p className="text-[13px] text-text-muted">No outgoing recommendation requests.</p>
        )}
      </section>

      {message ? <p className="text-[13px] text-text-muted">{message}</p> : null}
    </div>
  );
}

function displayName(profile: RecommendationRequestWithProfiles["requester"]) {
  if (!profile) {
    return "Unknown volunteer";
  }

  return profile.name || profile.uomEmail || profile.googleEmail || "Unknown volunteer";
}
