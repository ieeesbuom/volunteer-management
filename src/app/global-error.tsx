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
      <body className={`${inter.className} min-h-screen bg-[hsl(220,16%,96%)] px-6 py-16 text-[hsl(220,14%,32%)]`}>
        <main className="mx-auto max-w-lg rounded-[12px] border border-[hsl(220,13%,91%)] bg-white p-8 shadow-[0_1px_2px_hsl(220_26%_14%/0.04)]">
          <h1 className="text-xl font-semibold text-[hsl(220,26%,14%)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-[hsl(220,10%,52%)]">
            An unexpected error occurred. Please refresh the page and try again.
          </p>
        </main>
      </body>
    </html>
  );
}
