import "server-only";

import { cache } from "react";
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
import { isAppwriteNotFound } from "@/server/errors";
import type { Profile } from "@/features/access-control/types";

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
type RecognitionSnapshot = {
  generatedAt?: string;
  hallOfFame: HallOfFameEntry[];
  volunteerOfTheMonth: VolunteerOfTheMonth | null;
};
type RecognitionConfig = Awaited<ReturnType<typeof listRecognitionConfig>>;
type RecognitionInputs = {
  config: RecognitionConfig;
  ledger: PointLedgerEntry[];
  profilesByUserId: Map<string, Profile>;
};

const CURRENT_RECOGNITION_SNAPSHOT_ID = "recognition_current";
const CURRENT_RECOGNITION_SNAPSHOT_KEY = "recognition:current";

function parseIeeeTerm(label: string): IeeeTerm {
  const [start, end] = label.split("/");
  const startYear =
    start && start.length === 2 ? Number(`20${start}`) : Number(start);
  const endYear =
    end && end.length === 2 ? Number(`20${end}`) : Number(end ?? startYear + 1);

  return {
    endYear: Number.isFinite(endYear) ? endYear : startYear + 1,
    label,
    startYear: Number.isFinite(startYear) ? startYear : new Date().getUTCFullYear(),
  };
}

const listLedgerEntries = cache(async function listLedgerEntries() {
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
});

const listRecognitionConfig = cache(async function listRecognitionConfig() {
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
});

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
  
  const variants = new Set<string>();
  variants.add(term);
  const shortMatch = term.match(/^(\d{2})\/(\d{2})$/);
  if (shortMatch) {
    variants.add(`20${shortMatch[1]}/20${shortMatch[2]}`);
    variants.add(`20${shortMatch[1]}/${shortMatch[2]}`);
  }
  const fullMatch = term.match(/^(\d{4})\/(\d{4})$/);
  if (fullMatch) {
    variants.add(`${fullMatch[1].slice(-2)}/${fullMatch[2].slice(-2)}`);
    variants.add(`${fullMatch[1]}/${fullMatch[2].slice(-2)}`);
  }

  const termIds = new Set(
    terms
      .filter((row) => variants.has(row.label) || variants.has(row.$id))
      .map((row) => row.$id),
  );

  return (
    termConfig.some(
      (row) =>
        row.userId === userId &&
        row.excludedFromTopBoard &&
        (variants.has(row.term) || row.year === parsedTerm.startYear),
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

async function getRecognitionInputs(): Promise<RecognitionInputs> {
  const [ledger, profiles, config] = await Promise.all([
    listLedgerEntries(),
    listProfiles(),
    listRecognitionConfig(),
  ]);

  return {
    config,
    ledger,
    profilesByUserId: new Map(profiles.map((profile) => [profile.authUserId, profile])),
  };
}

function getProfileDisplayName(profilesByUserId: Map<string, Profile>, userId: string) {
  const profile = profilesByUserId.get(userId);

  return profile?.name || profile?.googleEmail || "Unknown volunteer";
}

function buildVolunteerOfTheMonth(
  { config, ledger, profilesByUserId }: RecognitionInputs,
  date: Date,
): VolunteerOfTheMonth | null {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
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

  return {
    highlight: `${winner.points} points earned from approved event conclusions.`,
    month: date.toLocaleString(undefined, { month: "long", timeZone: "UTC" }),
    name: getProfileDisplayName(profilesByUserId, winner.userId),
    pointsEarned: winner.points,
    userId: winner.userId,
    year,
  };
}

function buildHallOfFame(
  { config, ledger, profilesByUserId }: RecognitionInputs,
  term: string,
): HallOfFameEntry[] {
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
    .map((entry, index) => ({
      name: getProfileDisplayName(profilesByUserId, entry.userId),
      pointsEarned: entry.points,
      rank: index + 1,
      term: termInfo,
      userId: entry.userId,
    }));
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
  return buildVolunteerOfTheMonth(await getRecognitionInputs(), date);
}

export async function getHallOfFame(
  term = deriveTermFromDate(new Date().toISOString()),
): Promise<HallOfFameEntry[]> {
  return buildHallOfFame(await getRecognitionInputs(), term);
}

export async function buildRecognitionSnapshot(date: Date = new Date()): Promise<RecognitionSnapshot> {
  const inputs = await getRecognitionInputs();

  return {
    generatedAt: new Date().toISOString(),
    hallOfFame: buildHallOfFame(inputs, deriveTermFromDate(date.toISOString())),
    volunteerOfTheMonth: buildVolunteerOfTheMonth(inputs, date),
  };
}

export async function getCachedRecognitionSnapshot(): Promise<RecognitionSnapshot | null> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recognitionSnapshots,
      CURRENT_RECOGNITION_SNAPSHOT_ID,
    );
    const payload = typeof row.payload === "string" ? row.payload : "";

    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(payload) as Partial<RecognitionSnapshot>;

    return {
      generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : parsed.generatedAt,
      hallOfFame: Array.isArray(parsed.hallOfFame) ? parsed.hallOfFame : [],
      volunteerOfTheMonth: parsed.volunteerOfTheMonth ?? null,
    };
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function writeRecognitionSnapshot({
  date = new Date(),
  generatedBy = "system",
}: {
  date?: Date;
  generatedBy?: string;
} = {}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const snapshot = await buildRecognitionSnapshot(date);
  const generatedAt = new Date().toISOString();
  const term = deriveTermFromDate(date.toISOString());
  const payload = JSON.stringify({
    ...snapshot,
    generatedAt,
  });
  const rowPayload = {
    generatedAt,
    generatedBy,
    kind: "recognition",
    month: date.getUTCMonth() + 1,
    payload,
    snapshotKey: CURRENT_RECOGNITION_SNAPSHOT_KEY,
    term,
    year: date.getUTCFullYear(),
  };

  try {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recognitionSnapshots,
      CURRENT_RECOGNITION_SNAPSHOT_ID,
      rowPayload,
    );

    return {
      snapshot,
      storedAt: String(row.generatedAt),
    };
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    const row = await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.recognitionSnapshots,
      CURRENT_RECOGNITION_SNAPSHOT_ID,
      rowPayload,
    );

    return {
      snapshot,
      storedAt: String(row.generatedAt),
    };
  }
}

export async function getRecognitionSnapshot(
  date: Date = new Date(),
  { preferCached = false }: { preferCached?: boolean } = {},
) {
  if (preferCached) {
    const cached = await getCachedRecognitionSnapshot();

    if (cached) {
      return cached;
    }
  }

  return buildRecognitionSnapshot(date);
}
