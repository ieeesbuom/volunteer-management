"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
      setStatus("idle");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  async function handleExport() {
    if (disabled) {
      return;
    }

    setPending(true);
    setStatus("idle");
    setMessage("");

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
    <div className="relative">
      <Button
        disabled={pending || disabled}
        onClick={handleExport}
        title={disabled && disabledReason ? disabledReason : undefined}
        type="button"
        variant="secondary"
      >
        <Download className="size-4" aria-hidden="true" />
        {pending ? "Exporting..." : "Export PDF"}
      </Button>
      {disabled && disabledReason ? <p className="sr-only">{disabledReason}</p> : null}
      {message ? (
        <p
          aria-live="polite"
          className={
            status === "error"
              ? "pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-xs text-danger"
              : status === "success"
                ? "pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-xs text-success"
                : "pointer-events-none absolute left-0 top-full z-10 mt-1 whitespace-nowrap text-xs text-text-body"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
