"use client";

import { useMemo, useState } from "react";
import { AppLink } from "@/components/layout/app-link";
import { Check, ChevronDown, X } from "lucide-react";
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

  const pendingIncoming = useMemo(
    () => requests.incoming.filter((request) => request.status === "PENDING"),
    [requests.incoming],
  );
  const pendingOutgoing = useMemo(
    () => requests.outgoing.filter((request) => request.status === "PENDING"),
    [requests.outgoing],
  );
  const pastOutgoing = useMemo(
    () => requests.outgoing.filter((request) => request.status !== "PENDING"),
    [requests.outgoing],
  );

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
        incoming: current.incoming.filter((request) => request.$id !== requestId),
      }));
      setDrafts((current) => ({ ...current, [requestId]: "" }));
      setMessage(response === "ACCEPTED" ? "Recommendation submitted." : "Request rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommendation response failed.");
    } finally {
      setPendingAction(null);
    }
  }

  const hasAnyVisible =
    pendingIncoming.length > 0 || pendingOutgoing.length > 0 || pastOutgoing.length > 0;

  return (
    <div className="min-w-0 space-y-6">
      {pendingIncoming.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-text-strong">Incoming requests</h3>
          <div className="space-y-3">
            {pendingIncoming.map((request) => (
              <div
                className="rounded-2xl border border-border-subtle bg-surface-raised p-4"
                key={request.$id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-text-strong">
                      {request.requester ? (
                        <AppLink
                          href={`/volunteers/${request.requesterId}`}
                          className="cursor-pointer transition-colors hover:text-primary"
                        >
                          {displayName(request.requester)}
                        </AppLink>
                      ) : (
                        "Unknown volunteer"
                      )}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
                      {request.message || "No message provided."}
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-text-muted">Pending</span>
                </div>
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
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pendingOutgoing.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-text-strong">Outgoing requests</h3>
          <OutgoingRequestsTable requests={pendingOutgoing} />
        </section>
      ) : null}

      {pastOutgoing.length > 0 ? (
        <details className="group rounded-xl border border-border-subtle bg-bg-base/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-text-strong [&::-webkit-details-marker]:hidden">
            Past requests
            <ChevronDown
              className="size-4 text-text-muted transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-border-subtle px-4 pb-4 pt-3">
            <OutgoingRequestsTable requests={pastOutgoing} />
          </div>
        </details>
      ) : null}

      {!hasAnyVisible ? (
        <p className="text-[13px] text-text-muted">No pending recommendation requests.</p>
      ) : null}

      {message ? <p className="text-[13px] text-text-muted">{message}</p> : null}
    </div>
  );
}

function OutgoingRequestsTable({
  requests,
}: {
  requests: RecommendationRequestWithProfiles[];
}) {
  return (
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
        {requests.map((request) => (
          <tr
            key={request.$id}
            className="border-b border-border-subtle last:border-b-0 hover:bg-bg-base/50"
          >
            <td className="px-4 py-3.5 text-[13px] font-medium text-text-strong">
              {request.respondent ? (
                <AppLink
                  href={`/volunteers/${request.respondentId}`}
                  className="cursor-pointer transition-colors hover:text-primary"
                >
                  {displayName(request.respondent)}
                </AppLink>
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
  );
}

function displayName(profile: RecommendationRequestWithProfiles["requester"]) {
  if (!profile) {
    return "Unknown volunteer";
  }

  return profile.name || profile.uomEmail || profile.googleEmail || "Unknown volunteer";
}
