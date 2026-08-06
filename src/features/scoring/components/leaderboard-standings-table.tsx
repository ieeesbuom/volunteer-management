import {
  LeaderboardTableHead,
  LeaderboardTableShell,
  PointsPill,
  RankBadge,
  rankRowClasses,
  VolunteerLeaderboardCell,
} from "@/components/leaderboard/leaderboard-table-ui";
import { cn } from "@/lib/utils";

export type LeaderboardStandingsRow = {
  rank: number;
  userId: string;
  name: string;
  points: number;
};

export function LeaderboardStandingsTable({
  rows,
  currentUserId,
}: {
  rows: LeaderboardStandingsRow[];
  currentUserId?: string;
}) {
  return (
    <LeaderboardTableShell minWidth={560}>
      <colgroup>
        <col className="w-[96px]" />
        <col />
        <col className="w-[120px]" />
      </colgroup>
      <LeaderboardTableHead
        columns={[
          { label: "Rank" },
          { label: "Volunteer" },
          { label: "Points", align: "right" },
        ]}
      />
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.userId}
            className={cn(
              "border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-base/70",
              rankRowClasses(row.rank),
            )}
          >
            <td className="px-4 py-3.5">
              <RankBadge rank={row.rank} />
            </td>
            <td className="px-4 py-3.5">
              <VolunteerLeaderboardCell
                userId={row.userId}
                name={row.name}
                isSelf={currentUserId === row.userId}
              />
            </td>
            <td className="px-4 py-3.5 text-right">
              <PointsPill value={row.points} />
            </td>
          </tr>
        ))}
      </tbody>
    </LeaderboardTableShell>
  );
}
