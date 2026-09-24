"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canApproveReport,
  reportStatusTone,
} from "@/features/reports/lib/approval-rules";
import {
  reopenConclusionReportRequest,
  reviewConclusionReportRequest,
} from "@/features/reports/lib/api-client";
import type { ConclusionReport } from "@/features/reports/types";
import { conclusionReportAttachmentPath } from "@/features/reports/lib/conclusion-attachment";
import {
  alertDangerClasses,
  alertSuccessClasses,
  fieldTextareaClasses,
  tableBodyRowClasses,
  tableHeadCellClasses,
  tableHeadRowClasses,
} from "@/components/ui/field";

const inputClasses = fieldTextareaClasses;

type ConclusionApprovalPanelProps = {
  initialReports: ConclusionReport[];
};

export function ConclusionApprovalPanel({ initialReports }: ConclusionApprovalPanelProps) {
  const [reports, setReports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState(
    initialReports.find((report) => report.status === "SUBMITTED")?.$id ??
      initialReports[0]?.$id ??
      "",
  );
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [pending, setPending] = useState(false);

  const selectedReport = reports.find((report) => report.$id === selectedId) ?? null;
  const pendingReports = reports.filter((report) => report.status === "SUBMITTED");

  async function review(nextStatus: "APPROVED" | "REJECTED") {
    if (!selectedReport || !canApproveReport(selectedReport)) {
      return;
    }

    setPending(true);
    setStatus("idle");

    try {
      const { report } = await reviewConclusionReportRequest(selectedReport.$id, {
        reviewNote: reviewNote || undefined,
        status: nextStatus,
      });

      setReports((current) =>
        current.map((entry) => (entry.$id === report.$id ? report : entry)),
      );
      setReviewNote("");
      setStatus("success");
      setMessage(`Report ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Review failed.");
    } finally {
      setPending(false);
    }
  }

  async function reopen() {
    if (!selectedReport || selectedReport.status === "DRAFT") {
      return;
    }

    setPending(true);
    setStatus("idle");

    try {
      const report = await reopenConclusionReportRequest(selectedReport.$id);

      setReports((current) =>
        current.map((entry) => (entry.$id === report.$id ? report : entry)),
      );
      setStatus("success");
      setMessage("Report reopened to draft.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Reopen failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Total reports" value={String(reports.length)} />
        <SummaryTile label="Awaiting review" value={String(pendingReports.length)} />
        <SummaryTile
          label="Approved"
          value={String(reports.filter((report) => report.status === "APPROVED").length)}
        />
      </section>

      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="min-w-[920px] text-left text-[13px] text-text-body">
          <thead>
            <tr className={tableHeadRowClasses}>
              <th className={tableHeadCellClasses}>Event</th>
              <th className={tableHeadCellClasses}>Submitted by</th>
              <th className={tableHeadCellClasses}>Status</th>
              <th className={tableHeadCellClasses}>Updated</th>
              <th className={tableHeadCellClasses}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr className={tableBodyRowClasses} key={report.$id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-text-strong">{report.eventTitle}</p>
                </td>
                <td className="px-4 py-3 text-text-body">{report.submittedByName}</td>
                <td className="px-4 py-3">
                  <Badge tone={reportStatusTone(report.status)}>{report.status}</Badge>
                </td>
                <td className="px-4 py-3 text-text-body">
                  {new Date(report.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Button onClick={() => setSelectedId(report.$id)} type="button">
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReport ? (
        <section className="rounded-xl border border-border-subtle bg-bg-base/40 p-4">
          <div>
            <p className="text-sm font-medium text-text-body">Selected report</p>
            <h3 className="mt-1 text-lg font-semibold text-text-strong">
              {selectedReport.eventTitle}
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            <ReviewBlock label="More information" value={selectedReport.content.additionalInfo} />
            {selectedReport.content.reportFileId ? (
              <a
                className="inline-flex text-sm font-medium text-primary hover:underline"
                href={conclusionReportAttachmentPath(selectedReport.$id)}
                rel="noopener noreferrer"
                target="_blank"
              >
                View uploaded report
                {selectedReport.content.reportFileName
                  ? ` (${selectedReport.content.reportFileName})`
                  : ""}
              </a>
            ) : (
              <p className="text-sm text-text-muted">No report PDF uploaded.</p>
            )}
          </div>

          {canApproveReport(selectedReport) ? (
            <div className="mt-4 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-text-body">Review note</span>
                <textarea
                  className={inputClasses}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Optional note for the submitter"
                  value={reviewNote}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending}
                  onClick={() => review("APPROVED")}
                  type="button"
                  variant="primary"
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button disabled={pending} onClick={() => review("REJECTED")} type="button">
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          {selectedReport.status !== "DRAFT" ? (
            <div className="mt-4">
              <Button disabled={pending} onClick={reopen} type="button" variant="secondary">
                <RotateCcw className="size-4" aria-hidden="true" />
                Reopen to draft
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p
          className={
            status === "error" ? alertDangerClasses : alertSuccessClasses
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-base/40 px-4 py-3">
      <p className="text-sm font-medium text-text-body">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-strong">{value}</p>
    </div>
  );
}

function ReviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-3">
      <p className="text-sm font-medium text-text-body">{label}</p>
      <p className="mt-2 text-sm leading-6 text-text-strong">{value || "Not provided."}</p>
    </div>
  );
}
