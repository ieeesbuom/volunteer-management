"use client";

import { useRef, useState } from "react";
import { ClipboardList, FileUp, Save, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canEditReportContent,
  canSubmitReport,
  reportStatusTone,
} from "@/features/reports/lib/approval-rules";
import {
  createConclusionReportRequest,
  updateConclusionReportRequest,
  uploadConclusionReportPdfRequest,
} from "@/features/reports/lib/api-client";
import {
  CONCLUSION_REPORT_PDF_ACCEPT,
  conclusionReportAttachmentPath,
} from "@/features/reports/lib/conclusion-attachment";
import type { ConclusionReport, ReportEvent } from "@/features/reports/types";

const inputClasses =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary";

const textareaClasses = `${inputClasses} min-h-[120px] resize-y`;

type ConclusionReportFormProps = {
  events: ReportEvent[];
  initialReport?: ConclusionReport | null;
  onChange: (report: ConclusionReport) => void;
};

export function ConclusionReportForm({
  events,
  initialReport,
  onChange,
}: ConclusionReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [eventId, setEventId] = useState(initialReport?.eventId ?? events[0]?.eventId ?? "");
  const [additionalInfo, setAdditionalInfo] = useState(initialReport?.content.additionalInfo ?? "");
  const [report, setReport] = useState<ConclusionReport | null>(initialReport ?? null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [pending, setPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);

  const selectedEvent = events.find((event) => event.eventId === eventId);
  const contentEditable = !report || canEditReportContent(report);
  const uploadedFileName = report?.content.reportFileName;

  if (events.length === 0 && !report) {
    return (
      <p className="text-sm text-text-secondary">
        No ongoing or pending events are available for conclusion reporting.
      </p>
    );
  }

  async function ensureReportDraft() {
    if (report) {
      return report;
    }

    const created = await createConclusionReportRequest({
      content: { additionalInfo },
      eventId,
    });
    setReport(created);
    onChange(created);
    return created;
  }

  async function persist(nextStatus?: "SUBMITTED") {
    setPending(true);
    setStatus("idle");

    try {
      let nextReport = report;

      if (!nextReport) {
        nextReport = await createConclusionReportRequest({
          content: { additionalInfo },
          eventId,
        });
      } else if (contentEditable) {
        nextReport = await updateConclusionReportRequest(nextReport.$id, {
          content: { additionalInfo },
        });
      }

      if (nextStatus === "SUBMITTED" && nextReport.status !== "SUBMITTED") {
        nextReport = await updateConclusionReportRequest(nextReport.$id, {
          status: "SUBMITTED",
        });
      }

      setReport(nextReport);
      onChange(nextReport);
      setStatus("success");
      setMessage(nextStatus === "SUBMITTED" ? "Report submitted for approval." : "Draft saved.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save report.");
    } finally {
      setPending(false);
    }
  }

  async function handlePdfUpload(file: File) {
    setUploadPending(true);
    setStatus("idle");

    try {
      const currentReport = await ensureReportDraft();
      const updated = await uploadConclusionReportPdfRequest(currentReport.$id, file);
      setReport(updated);
      onChange(updated);
      setStatus("success");
      setMessage("Report PDF uploaded.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not upload report PDF.");
    } finally {
      setUploadPending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const draftCandidate = {
    content: {
      additionalInfo,
      reportFileId: report?.content.reportFileId,
    },
    status: report?.status ?? "DRAFT",
  } as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-md border border-border bg-surface-subtle text-primary">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-text-secondary">Conclusion report</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-primary">
              {selectedEvent?.eventTitle ?? "Select an event"}
            </p>
            {report ? <Badge tone={reportStatusTone(report.status)}>{report.status}</Badge> : null}
          </div>
        </div>
      </div>

      {!initialReport ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-text-secondary">Event</span>
          <select
            className={inputClasses}
            disabled={Boolean(report)}
            onChange={(event) => setEventId(event.target.value)}
            value={eventId}
          >
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.eventTitle} ({event.status})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-text-secondary">More information</span>
        <textarea
          className={textareaClasses}
          disabled={!contentEditable}
          onChange={(event) => setAdditionalInfo(event.target.value)}
          placeholder="Optional notes or context for the admin reviewer"
          value={additionalInfo}
        />
      </label>

      <div className="space-y-2 rounded-md border border-border bg-surface-subtle p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-secondary">Report PDF</p>
            <p className="mt-1 text-xs text-text-muted">Upload the event report as a PDF file only.</p>
          </div>
          {uploadedFileName ? (
            <Badge tone="success">{uploadedFileName}</Badge>
          ) : (
            <Badge tone="neutral">Required before submit</Badge>
          )}
        </div>

        {contentEditable ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              accept={CONCLUSION_REPORT_PDF_ACCEPT}
              className="sr-only"
              disabled={uploadPending || pending}
              id="conclusion-report-pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handlePdfUpload(file);
                }
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={uploadPending || pending}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              <FileUp className="size-4" aria-hidden="true" />
              {uploadPending ? "Uploading..." : uploadedFileName ? "Replace PDF" : "Upload PDF"}
            </Button>
          </div>
        ) : report?.content.reportFileId ? (
          <a
            className="inline-flex text-sm font-medium text-primary hover:underline"
            href={conclusionReportAttachmentPath(report.$id)}
            rel="noopener noreferrer"
            target="_blank"
          >
            View uploaded report
          </a>
        ) : null}
      </div>

      {message ? (
        <p
          className={
            status === "error"
              ? "rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
              : "rounded-md border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {contentEditable ? (
          <Button disabled={pending || uploadPending} onClick={() => persist()} type="button">
            <Save className="size-4" aria-hidden="true" />
            Save draft
          </Button>
        ) : null}
        {contentEditable ? (
          <Button
            disabled={pending || uploadPending || !canSubmitReport(draftCandidate)}
            onClick={() => persist("SUBMITTED")}
            type="button"
            variant="primary"
          >
            <Send className="size-4" aria-hidden="true" />
            Submit for approval
          </Button>
        ) : null}
      </div>
    </div>
  );
}
