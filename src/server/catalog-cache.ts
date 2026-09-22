import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { Query } from "node-appwrite";
import { LISTABLE_PUBLIC_STATUSES } from "@/features/events/lib/event-permissions";
import type { PointLedgerEntry, TermScoringConfig } from "@/features/scoring/types";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";

export const CATALOG_TAGS = {
  events: "catalog:events",
  formConnections: "catalog:form-connections",
  profiles: "catalog:profiles",
  scoringInputs: "catalog:scoring-inputs",
} as const;

export type CatalogTag = (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS];

const CATALOG_REVALIDATE_SECONDS = 45;

export type CatalogRow = Record<string, unknown> & { $id: string };

export type ScoringCatalogInputs = {
  configs: TermScoringConfig[];
  exclusions: Array<{
    active: boolean;
    revokedAt?: string | null;
    termId: string;
    userId: string;
  }>;
  ledger: PointLedgerEntry[];
  terms: Array<{ $id: string; label: string }>;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isVitestRuntime() {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

function isMissingNextCacheStore(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("static generation store missing") ||
    error.message.includes("incrementalCache missing")
  );
}

/**
 * Wrap an Appwrite catalog loader with Next `unstable_cache`.
 * Under Vitest (no Next request cache), call the loader directly.
 */
function withCatalogCache<T>(
  loader: () => Promise<T>,
  keyParts: string[],
  tag: CatalogTag,
): () => Promise<T> {
  const cached = unstable_cache(loader, keyParts, {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [tag],
  });

  return async () => {
    if (isVitestRuntime()) {
      return loader();
    }

    try {
      return await cached();
    } catch (error) {
      if (isMissingNextCacheStore(error)) {
        return loader();
      }
      throw error;
    }
  };
}

/** Immediately expire tagged catalog entries after writes. */
export function invalidateCatalog(...tags: CatalogTag[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      // Unit tests and non-request contexts have no Next cache store.
      if (!isMissingNextCacheStore(error)) {
        throw error;
      }
    }
  }
}

const loadAllEventRows = withCatalogCache(
  async () => {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const result = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.events,
      [Query.orderDesc("created_at"), Query.limit(500)],
      undefined,
      false,
    );

    return cloneJson(result.rows as unknown as CatalogRow[]);
  },
  ["catalog", "events", "all"],
  CATALOG_TAGS.events,
);

const loadPublicEventRows = withCatalogCache(
  async () => {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const result = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.events,
      [
        Query.equal("status", [...LISTABLE_PUBLIC_STATUSES]),
        Query.orderDesc("created_at"),
        Query.limit(500),
      ],
      undefined,
      false,
    );

    return cloneJson(result.rows as unknown as CatalogRow[]);
  },
  ["catalog", "events", "public"],
  CATALOG_TAGS.events,
);

const loadProfileRows = withCatalogCache(
  async () => {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const result = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      [Query.limit(500), Query.orderDesc("lastLoginAt")],
      undefined,
      false,
    );

    return cloneJson(result.rows as unknown as CatalogRow[]);
  },
  ["catalog", "profiles"],
  CATALOG_TAGS.profiles,
);

const loadFormConnectionRows = withCatalogCache(
  async () => {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const result = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.formConnections,
      [Query.orderDesc("updatedAt"), Query.limit(100)],
      undefined,
      false,
    );

    return cloneJson(result.rows as unknown as CatalogRow[]);
  },
  ["catalog", "form-connections"],
  CATALOG_TAGS.formConnections,
);

const loadScoringInputs = withCatalogCache(
  async () => {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const [ledgerResult, configResult, exclusionResult, termsResult] = await Promise.all([
      tables.listRows(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.pointLedger, [
        Query.limit(1000),
      ]),
      tables.listRows(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.termScoringConfig, [
        Query.limit(1000),
      ]),
      tables.listRows(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.topBoardExclusions, [
        Query.equal("active", true),
        Query.limit(1000),
      ]),
      tables.listRows(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.ieeeTerms, [
        Query.limit(100),
      ]),
    ]);

    return cloneJson({
      configs: configResult.rows as unknown as TermScoringConfig[],
      exclusions: exclusionResult.rows as unknown as ScoringCatalogInputs["exclusions"],
      ledger: ledgerResult.rows as unknown as PointLedgerEntry[],
      terms: termsResult.rows as unknown as ScoringCatalogInputs["terms"],
    } satisfies ScoringCatalogInputs);
  },
  ["catalog", "scoring-inputs"],
  CATALOG_TAGS.scoringInputs,
);

export async function getCachedAllEventRows() {
  return loadAllEventRows();
}

export async function getCachedPublicEventRows() {
  return loadPublicEventRows();
}

export async function getCachedProfileRows() {
  return loadProfileRows();
}

export async function getCachedFormConnectionRows() {
  return loadFormConnectionRows();
}

export async function getCachedScoringInputs() {
  return loadScoringInputs();
}
