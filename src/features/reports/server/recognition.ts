import "server-only";

import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listConclusionReports } from "@/features/reports/server/conclusion-service";
import type {
  EventSummary,
  HallOfFameEntry,
  IeeeTerm,
  VolunteerOfTheMonth,
} from "@/features/reports/types";
import type { PointLedgerEntry, TermScoringConfig } from "@/features/scoring/types";
import { deriveTermFromDate, filterLedgerByMonth, filterLedgerByTerm } from "@/features/scoring/lib/helpers";
import { listEvents } from "@/features/events/server/event-service";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";

type IeeeTermRow = {
  $id: string;
  label: string;
};

type TopBoardExclusionRow = {
  active: boolean;
  revokedAt?: string | null;
  termId: string;
  userId: string;
};

function parseIeeeTerm(label: string): IeeeTerm {
  const [start, end] = label.split("/");
  const startYear = Number(start);
  const endYear =
    end && end.length === 2 ? Number(`20${end}`) : Number(end ?? startYear + 1);

  return {
    endYear: Number.isFinite(endYear) ? endYear : startYear + 1,
    label,
    startYear: Number.isFinite(startYear) ? startYear : new Date().getUTCFullYear(),
  };
}

async function listLedgerEntries() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [Query.limit(1000)],
    undefined,
    false,
  );

  return result.rows as unknown as PointLedgerEntry[];
}

async function listRecognitionConfig() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const [termConfig, topBoardExclusions, terms] = await Promise.all([
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      [Query.limit(1000)],
      undefined,
      false,
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.topBoardExclusions,
      [Query.equal("active", true), Query.limit(1000)],
      undefined,
      false,
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.ieeeTerms,
      [Query.limit(100)],
      undefined,
      false,
    ),
  ]);

  return {
    termConfig: termConfig.rows as unknown as TermScoringConfig[],
    terms: terms.rows as unknown as IeeeTermRow[],
    topBoardExclusions: topBoardExclusions.rows as unknown as TopBoardExclusionRow[],
  };
}

function isExcludedFromRecognition({
  term,
  termConfig,
  terms,
  topBoardExclusions,
  userId,
}: {
  term: string;
  termConfig: TermScoringConfig[];
  terms: IeeeTermRow[];
  topBoardExclusions: TopBoardExclusionRow[];
  userId: string;
}) {
  const parsedTerm = parseIeeeTerm(term);
  const termIds = new Set(
    terms
      .filter((row) => row.label === term || row.$id === term)
      .map((row) => row.$id),
  );

  return (
    termConfig.some(
      (row) =>
        row.userId === userId &&
        row.excludedFromTopBoard &&
        (row.term === term || row.year === parsedTerm.startYear),
    ) ||
    topBoardExclusions.some(
      (row) =>
        row.userId === userId &&
        row.active &&
        !row.revokedAt &&
        termIds.has(row.termId),
    )
  );
}

function aggregatePoints(entries: PointLedgerEntry[]) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + Number(entry.points));
  }

  return [...totals.entries()]
    .map(([userId, points]) => ({ points, userId }))
    .filter((entry) => entry.points > 0)
    .sort((left, right) => right.points - left.points);
}

export async function listEventSummaries(): Promise<EventSummary[]> {
  const [events, reports, ledger] = await Promise.all([
    listEvents(),
    listConclusionReports(),
    listLedgerEntries(),
  ]);

  return events
    .map((event) => {
      const report = reports.find((entry) => entry.eventId === event.$id);
      const volunteerCount = new Set(
        ledger.filter((entry) => entry.eventId === event.$id).map((entry) => entry.userId),
      ).size;

      return {
        eventId: event.$id,
        eventTitle: event.title,
        heldOn: event.end_date ?? event.start_date,
        reportId: report?.$id,
        reportStatus: report?.status,
        status: event.status.toUpperCase() as EventSummary["status"],
        summary: report
          ? `Conclusion report is ${report.status.toLowerCase()}.`
          : "No conclusion report submitted yet.",
        volunteerCount,
      } satisfies EventSummary;
    })
    .sort(
      (left, right) => new Date(right.heldOn).getTime() - new Date(left.heldOn).getTime(),
    );
}

export async function getVolunteerOfTheMonth(
  date: Date = new Date(),
): Promise<VolunteerOfTheMonth | null> {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const [ledger, profiles, config] = await Promise.all([
    listLedgerEntries(),
    listProfiles(),
    listRecognitionConfig(),
  ]);
  const targetTerm = deriveTermFromDate(
    new Date(Date.UTC(year, month - 1, 1)).toISOString(),
  );
  const eligibleEntries = filterLedgerByMonth(ledger, month, year).filter(
    (entry) =>
      !isExcludedFromRecognition({
        term: targetTerm,
        termConfig: config.termConfig,
        terms: config.terms,
        topBoardExclusions: config.topBoardExclusions,
        userId: entry.userId,
      }),
  );
  const winner = aggregatePoints(eligibleEntries)[0];

  if (!winner) {
    return null;
  }

  const profile = profiles.find((entry) => entry.authUserId === winner.userId);

  return {
    highlight: `${winner.points} points earned from approved event conclusions.`,
    month: date.toLocaleString(undefined, { month: "long", timeZone: "UTC" }),
    name: profile?.name || profile?.googleEmail || winner.userId,
    pointsEarned: winner.points,
    userId: winner.userId,
    year,
  };
}

export async function getHallOfFame(
  term = deriveTermFromDate(new Date().toISOString()),
): Promise<HallOfFameEntry[]> {
  const [ledger, profiles, config] = await Promise.all([
    listLedgerEntries(),
    listProfiles(),
    listRecognitionConfig(),
  ]);
  const termInfo = parseIeeeTerm(term);
  const eligibleEntries = filterLedgerByTerm(ledger, term).filter(
    (entry) =>
      !isExcludedFromRecognition({
        term,
        termConfig: config.termConfig,
        terms: config.terms,
        topBoardExclusions: config.topBoardExclusions,
        userId: entry.userId,
      }),
  );

  return aggregatePoints(eligibleEntries)
    .slice(0, 10)
    .map((entry, index) => {
      const profile = profiles.find((profile) => profile.authUserId === entry.userId);

      return {
        name: profile?.name || profile?.googleEmail || entry.userId,
        pointsEarned: entry.points,
        rank: index + 1,
        term: termInfo,
        userId: entry.userId,
      };
    });
}

