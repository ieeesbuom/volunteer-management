"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alertDangerClasses, alertSuccessClasses, fieldInputClasses } from "@/components/ui/field";
import { isUomEmail, UOM_EMAIL_DOMAIN } from "@/lib/config";
import { formatUserFacingError } from "@/lib/utils";

type RequestResult = {
  deliveredTo: string;
  expiresAt: string;
  requestId: string;
};

export function VerificationPanel() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [requestResult, setRequestResult] = useState<RequestResult | null>(null);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitting, setSubmitting] = useState<"confirm" | "request" | null>(null);
  const [uomEmail, setUomEmail] = useState("");

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isUomEmail(uomEmail)) {
      setStatus("error");
      setMessage(`Use your University of Moratuwa email ending with @${UOM_EMAIL_DOMAIN}.`);
      return;
    }

    setSubmitting("request");
    setStatus("idle");
    setMessage("Sending verification email...");

    try {
      const response = await fetch("/api/uom-verification/request", {
        body: JSON.stringify({ uomEmail }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(formatUserFacingError(payload.error, "Could not send the verification email."));
        return;
      }

      setRequestResult(payload);
      setStatus("success");
      setMessage(`Verification code sent to ${payload.deliveredTo}. Check your UoM webmail.`);
    } finally {
      setSubmitting(null);
    }
  }

  async function confirmCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requestResult) {
      setStatus("error");
      setMessage("Request a code first.");
      return;
    }

    setSubmitting("confirm");
    setStatus("idle");
    setMessage("Confirming code...");
    try {
      const response = await fetch("/api/uom-verification/confirm", {
        body: JSON.stringify({ code, requestId: requestResult.requestId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(formatUserFacingError(payload.error, "Could not confirm code. Please check and try again."));
        return;
      }

      setStatus("success");
      setMessage("UoM email verified.");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-base text-primary">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-strong">Request code</h3>
          <p className="text-sm leading-6 text-text-body">
            Enter your University of Moratuwa email ending with @{UOM_EMAIL_DOMAIN}.
          </p>
        </div>
        <form className="space-y-3" onSubmit={requestCode}>
          <label className="block text-sm font-medium text-text-body" htmlFor="uom-email">
            UoM email
          </label>
          <input
            className={fieldInputClasses}
            id="uom-email"
            onChange={(event) => setUomEmail(event.target.value)}
            pattern={`^[^\\s@]+@${UOM_EMAIL_DOMAIN.replace(".", "\\.")}$`}
            placeholder="name@uom.lk"
            required
            type="email"
            value={uomEmail}
          />
          <Button disabled={submitting === "request"} type="submit" variant="primary">
            <Send className="size-4" aria-hidden="true" />
            {submitting === "request" ? "Sending" : "Send Code"}
          </Button>
        </form>
      </section>

      {requestResult ? (
        <div className={`${alertSuccessClasses} p-4`}>
          <p className="font-semibold">Verification email sent</p>
          <p className="mt-1">
            Sent to {requestResult.deliveredTo}. The code expires at{" "}
            {new Date(requestResult.expiresAt).toLocaleString()}.
          </p>
        </div>
      ) : null}

      <section className="grid gap-5 border-t border-border-subtle pt-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border-subtle bg-bg-base text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-strong">Confirm code</h3>
          <p className="text-sm leading-6 text-text-body">
            Enter the code from webmail to complete verification.
          </p>
        </div>
        <form className="space-y-3" onSubmit={confirmCode}>
          <label className="block text-sm font-medium text-text-body" htmlFor="code">
            Verification code
          </label>
          <input
            className={fieldInputClasses}
            id="code"
            inputMode="numeric"
            onChange={(event) => setCode(event.target.value)}
            placeholder="6-digit code"
            required
            value={code}
          />
          <Button disabled={submitting === "confirm" || !requestResult} type="submit">
            <KeyRound className="size-4" aria-hidden="true" />
            {submitting === "confirm" ? "Confirming" : "Confirm Code"}
          </Button>
        </form>
      </section>

      {message ? (
        <p
          className={
            status === "error"
              ? alertDangerClasses
              : "text-sm text-text-body"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
