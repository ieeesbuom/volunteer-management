export default function Loading() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Skeleton (hidden on mobile, visible on lg) */}
      <div className="hidden lg:flex w-60 flex-col border-r border-border-subtle bg-surface">
        <div className="flex h-[72px] items-center px-6 border-b border-border-subtle">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="flex-1 space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-9 w-full animate-pulse rounded-md bg-surface-muted"
            />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header Skeleton */}
        <div className="flex h-16 items-center border-b border-border-subtle bg-surface px-4 lg:hidden">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
        </div>

        {/* Content Skeleton */}
        <main className="flex-1 p-6 lg:p-8 space-y-8">
          {/* Page Header Skeleton */}
          <div className="space-y-3">
            <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-96 animate-pulse rounded bg-surface-muted" />
          </div>

          {/* Cards/Grids Skeleton */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-40 w-full animate-pulse rounded-[12px] border border-border-subtle bg-surface"
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
