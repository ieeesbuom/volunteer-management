import Link from "next/link";
import { cn } from "@/lib/utils";

export function volunteerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "—";
}

export function rankBadgeClasses(rank: number) {
  if (rank === 1) {
    return "border-gold/45 bg-gold/15 text-[hsl(43,90%,32%)]";
  }
  if (rank === 2) {
    return "border-silver/55 bg-neutral-soft text-text-body";
  }
  if (rank === 3) {
    return "border-bronze/45 bg-bronze/15 text-[hsl(20,65%,32%)]";
  }
  return "border-border-subtle bg-bg-base text-text-muted";
}

export function rankRowClasses(rank: number) {
  if (rank === 1) {
    return "bg-gold/[0.06]";
  }
  if (rank === 2) {
    return "bg-neutral-soft/40";
  }
  if (rank === 3) {
    return "bg-bronze/[0.06]";
  }
  return "";
}

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border text-[12px] font-bold tabular-nums",
        rankBadgeClasses(rank),
      )}
    >
      #{rank}
    </span>
  );
}

export function PointsPill({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[3rem] items-center justify-center rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-[13px] font-bold tabular-nums text-primary",
        className,
      )}
    >
      {value}
    </span>
  );
}

export function SelfPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
      You
    </span>
  );
}

export function LeaderboardTableShell({
  children,
  minWidth = 480,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-border-subtle bg-surface-raised">
      <table
        className="w-full border-collapse text-left text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
    </div>
  );
}

export function LeaderboardTableHead({
  columns,
}: {
  columns: { label: string; align?: "left" | "right" }[];
}) {
  return (
    <thead>
      <tr className="border-b border-border-subtle bg-bg-base">
        {columns.map((col) => (
          <th
            key={col.label}
            className={cn(
              "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted",
              col.align === "right" ? "text-right" : "text-left",
            )}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function VolunteerLeaderboardCell({
  userId,
  name,
  link = true,
  isSelf = false,
}: {
  userId: string;
  name: string;
  link?: boolean;
  isSelf?: boolean;
}) {
  const nameContent = link ? (
    <Link
      href={`/volunteers/${userId}`}
      className="truncate font-semibold text-text-strong transition-colors hover:text-primary cursor-pointer"
    >
      {name}
    </Link>
  ) : (
    <span className="truncate font-semibold text-text-strong">{name}</span>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-primary-soft text-[11px] font-bold text-primary"
        aria-hidden
      >
        {volunteerInitials(name)}
      </span>
      <div className="min-w-0 flex flex-wrap items-center gap-2">
        {nameContent}
        {isSelf ? <SelfPill /> : null}
      </div>
    </div>
  );
}
