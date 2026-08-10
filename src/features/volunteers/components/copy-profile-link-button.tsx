"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyProfileLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url =
      typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
      {copied ? (
        <>
          <Check className="size-4" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Link2 className="size-4" aria-hidden />
          Copy link
        </>
      )}
    </Button>
  );
}
