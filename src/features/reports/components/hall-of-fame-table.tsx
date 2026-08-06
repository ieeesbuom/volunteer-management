import {
  LeaderboardTableHead,
  LeaderboardTableShell,
  PointsPill,
  RankBadge,
  rankRowClasses,
  VolunteerLeaderboardCell,
} from "@/components/leaderboard/leaderboard-table-ui";
import { cn } from "@/lib/utils";

export type HallOfFameTableRow = {
  rank: number;
  userId: string;
  name: string;
  pointsEarned: number;
  termLabel: string;
};

export function HallOfFameTable({
  entries,
  linkVolunteerNames = false,
}: {
  entries: HallOfFameTableRow[];
  linkVolunteerNames?: boolean;
}) {
  return (
    <LeaderboardTableShell minWidth={520}>
      <colgroup>
        <col className="w-[96px]" />
        <col />
        <col className="w-[96px]" />
        <col className="w-[120px]" />
      </colgroup>
      <LeaderboardTableHead
        columns={[
          { label: "Rank" },
          { label: "Volunteer" },
          { label: "Term" },
          { label: "Points", align: "right" },
        ]}
      />
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.userId}
            className={cn(
              "border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-base/70",
              rankRowClasses(entry.rank),
            )}
          >
            <td className="px-4 py-3.5">
              <RankBadge rank={entry.rank} />
            </td>
            <td className="px-4 py-3.5">
              <VolunteerLeaderboardCell
                userId={entry.userId}
                name={entry.name}
                link={linkVolunteerNames}
              />
            </td>
            <td className="px-4 py-3.5 text-[13px] text-text-muted">{entry.termLabel}</td>
            <td className="px-4 py-3.5 text-right">
              <PointsPill value={entry.pointsEarned} />
            </td>
          </tr>
        ))}
      </tbody>
    </LeaderboardTableShell>
  );
}
