"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBase64Pdf } from "@/features/reports/lib/download";
import { exportVolunteerProfilePdfAction } from "@/features/reports/server/export-pdf";

type ExportActionsProps = {
  userId: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function ExportActions({ disabled, disabledReason, userId }: ExportActionsProps) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");

  async function handleExport() {
    if (disabled) {
      return;
    }

    setPending(true);
    setStatus("idle");
    setMessage("Generating PDF...");

    try {
      const result = await exportVolunteerProfilePdfAction(userId);
      downloadBase64Pdf({ base64: result.data, filename: result.filename });
      setStatus("success");
      setMessage("PDF downloaded.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button disabled={pending || disabled} onClick={handleExport} type="button" variant="secondary">
        <Download className="size-4" aria-hidden="true" />
        {pending ? "Exporting..." : "Export PDF"}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-xs text-text-muted">{disabledReason}</p>
      ) : null}
      {message ? (
        <p
          className={
            status === "error"
              ? "text-xs text-danger"
              : status === "success"
                ? "text-xs text-success"
                : "text-xs text-text-secondary"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
