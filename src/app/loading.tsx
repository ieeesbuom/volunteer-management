import { ShieldCheck } from "lucide-react";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">
              {ORGANIZATION_NAME}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md border border-primary/20 bg-primary-soft text-primary">
                <ShieldCheck className="size-4" aria-hidden="true" />
              </span>
              <h1 className="text-xl font-semibold text-text-primary">{APP_NAME}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {[96, 88, 104, 120, 112].map((width) => (
              <span
                className="h-10 animate-pulse rounded-md border border-border bg-surface-muted"
                key={width}
                style={{ width }}
              />
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl space-y-4 px-5 py-6 sm:px-8 lg:px-10">
        <div className="h-10 w-64 animate-pulse rounded-md bg-surface-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-36 animate-pulse rounded-md border border-border bg-surface"
              key={item}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
