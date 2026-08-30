"use client";

import * as Sentry from "@sentry/nextjs";
import { Inter } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-bg-base px-6 py-16 text-text-body`}>
        <main className="mx-auto max-w-lg rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-text-strong">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            An unexpected error occurred. Please refresh the page and try again.
          </p>
        </main>
      </body>
    </html>
  );
}
