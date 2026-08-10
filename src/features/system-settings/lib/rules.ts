import { EVENT_ROLES, SB_ROLES } from "@/lib/config";
import type {
  IeeeTerm,
  IeeeTermStatus,
  PermissionOverview,
  TopBoardExclusion,
} from "@/features/system-settings/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type TermDateRange = {
  endDate: string;
  startDate: string;
};

export type ActiveTermRepair = {
  active: boolean;
  reason:
    | "DRAFT_ACTIVE_FLAG_CLEARED"
    | "NON_SELECTED_ACTIVE_TERM_CLOSED"
    | "SELECTED_TERM_NORMALIZED";
  status: IeeeTermStatus;
  termId: string;
};

export function assertTermCanBeUpdated(
  term: Pick<IeeeTerm, "status">,
) {
  if (term.status === "CLOSED") {
    throw new Error("Closed IEEE terms are historical records and cannot be changed.");
  }
}

export function assertTermCanBeActivated(
  term: Pick<IeeeTerm, "status">,
) {
  if (term.status === "CLOSED") {
    throw new Error("Closed IEEE terms cannot be reactivated.");
  }
}

export function isIsoDateOnly(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertValidTermDates({ endDate, startDate }: TermDateRange) {
  if (!isIsoDateOnly(startDate) || !isIsoDateOnly(endDate)) {
    throw new Error("Term dates must use YYYY-MM-DD format.");
  }

  if (startDate >= endDate) {
    throw new Error("Term end date must be after the start date.");
  }
}

/** Canonical IEEE term labels use short years: 25/26, 26/27. */
export function formatTermLabel(startDate: string) {
  if (!isIsoDateOnly(startDate)) {
    throw new Error("Term start date must use YYYY-MM-DD format.");
  }

  const startYear = Number(startDate.slice(0, 4));
  const yy = String(startYear).slice(-2);
  const nextYy = String(startYear + 1).slice(-2);

  return `${yy}/${nextYy}`;
}

/**
 * Normalize any common IEEE term spelling to the canonical YY/YY form.
 * Accepts 25/26, 2025/26, and 2025/2026.
 */
export function normalizeIeeeTermLabel(label: string) {
  const trimmed = label.trim();
  const short = trimmed.match(/^(\d{2})\/(\d{2})$/);
  if (short) {
    return `${short[1]}/${short[2]}`;
  }

  const mid = trimmed.match(/^(\d{4})\/(\d{2})$/);
  if (mid) {
    return `${mid[1].slice(-2)}/${mid[2]}`;
  }

  const full = trimmed.match(/^(\d{4})\/(\d{4})$/);
  if (full) {
    return `${full[1].slice(-2)}/${full[2].slice(-2)}`;
  }

  return trimmed;
}

/** Matching variants for queries against mixed historical labels. */
export function ieeeTermLabelVariants(label: string) {
  const normalized = normalizeIeeeTermLabel(label);
  const short = normalized.match(/^(\d{2})\/(\d{2})$/);
  if (!short) {
    return Array.from(new Set([trimmedOrEmpty(label), normalized].filter(Boolean)));
  }

  const startFull = `20${short[1]}`;
  const endFull = `20${short[2]}`;

  return Array.from(
    new Set(
      [
        normalized,
        `${startFull}/${short[2]}`,
        `${startFull}/${endFull}`,
        trimmedOrEmpty(label),
      ].filter(Boolean),
    ),
  );
}

function trimmedOrEmpty(value: string) {
  return value.trim();
}

export function assertValidTermLabel(label: string, startDate: string) {
  const expectedLabel = formatTermLabel(startDate);

  if (normalizeIeeeTermLabel(label) !== expectedLabel) {
    throw new Error(`Term label must be ${expectedLabel} for the selected start date.`);
  }
}

export function getSuggestedTermRange(reference = new Date()) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const startYear = month >= 9 ? year : year - 1;

  return {
    endDate: `${startYear + 1}-09-30`,
    label: formatTermLabel(`${startYear}-10-01`),
    startDate: `${startYear}-10-01`,
  };
}

export function dateRangesOverlap(first: TermDateRange, second: TermDateRange) {
  assertValidTermDates(first);
  assertValidTermDates(second);

  return first.startDate <= second.endDate && second.startDate <= first.endDate;
}

export function assertNoOverlappingTerms(
  candidate: TermDateRange & { $id?: string },
  terms: Array<Pick<IeeeTerm, "$id" | "endDate" | "startDate">>,
) {
  assertValidTermDates(candidate);

  const overlap = terms.find(
    (term) =>
      term.$id !== candidate.$id &&
      dateRangesOverlap(candidate, term),
  );

  if (overlap) {
    throw new Error(`Term dates overlap with ${overlap.$id}.`);
  }
}

export function isActiveTopBoardExclusion(
  exclusion: Pick<TopBoardExclusion, "active" | "revokedAt">,
) {
  return exclusion.active && !exclusion.revokedAt;
}

export function resolveActiveTermState(
  terms: Array<Pick<IeeeTerm, "$id" | "active" | "status" | "updatedAt">>,
  configuredTermId?: string | null,
) {
  const normalizedConfiguredTermId = configuredTermId ?? "";
  const activeStatusTerms = terms
    .filter((term) => term.status === "ACTIVE")
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  const configuredTerm = terms.find(
    (term) =>
      term.$id === normalizedConfiguredTermId && term.status === "ACTIVE",
  );
  const selectedTerm =
    configuredTerm ??
    activeStatusTerms.find((term) => term.active) ??
    activeStatusTerms[0];
  const termRepairs: ActiveTermRepair[] = [];

  for (const term of terms) {
    if (term.$id === selectedTerm?.$id) {
      if (!term.active || term.status !== "ACTIVE") {
        termRepairs.push({
          active: true,
          reason: "SELECTED_TERM_NORMALIZED",
          status: "ACTIVE",
          termId: term.$id,
        });
      }

      continue;
    }

    if (term.active && term.status === "DRAFT") {
      termRepairs.push({
        active: false,
        reason: "DRAFT_ACTIVE_FLAG_CLEARED",
        status: "DRAFT",
        termId: term.$id,
      });
      continue;
    }

    if (term.active || term.status === "ACTIVE") {
      termRepairs.push({
        active: false,
        reason: "NON_SELECTED_ACTIVE_TERM_CLOSED",
        status: "CLOSED",
        termId: term.$id,
      });
    }
  }

  return {
    activeTermId: selectedTerm?.$id ?? "",
    duplicateActiveTermIds: termRepairs
      .filter((repair) => repair.reason === "NON_SELECTED_ACTIVE_TERM_CLOSED")
      .map((repair) => repair.termId),
    needsRepair:
      configuredTermId === null ||
      normalizedConfiguredTermId !== (selectedTerm?.$id ?? "") ||
      termRepairs.length > 0,
    termRepairs,
  };
}

export const SB_ROLE_POWERS: { description: string; id: string; label: string }[] = [
  { description: "Verify UoM emails, view volunteer directory, and manage profiles.", id: "volunteers.manage", label: "Manage Volunteers & Profiles" },
  { description: "Create new events, edit details, and control event status.", id: "events.manage", label: "Manage Events & Lifecycle" },
  { description: "Open or close IEEE terms and modify system settings.", id: "settings.manage", label: "Manage System & Terms" },
  { description: "Review and approve volunteer recognition requests.", id: "recommendations.review", label: "Approve Recommendations" },
  { description: "Verify volunteer point requests and audit score ledger.", id: "scoring.audit", label: "Audit Scoring & Points" },
  { description: "View event conclusion reports and export volunteer summaries.", id: "reports.access", label: "Access & Export Reports" },
];

export const EVENT_ROLE_POWERS: { description: string; id: string; label: string }[] = [
  { description: "Modify event title, dates, descriptions, and transition status.", id: "event.details", label: "Update Event Details & Status" },
  { description: "Create structural committees and add or remove members.", id: "event.committees", label: "Manage Committees & Members" },
  { description: "Assign vice chairs, committee leads, and team roles.", id: "event.roles", label: "Assign Sub-Roles & Leads" },
  { description: "Connect registration forms and control attendance links.", id: "event.forms", label: "Manage Forms & Registrations" },
  { description: "Generate and submit event conclusion reports for approval.", id: "event.reports", label: "Draft Conclusion Reports" },
];

export const DEFAULT_SB_ROLE_POWERS: Record<string, string[]> = {
  Chairperson: ["volunteers.manage", "events.manage", "settings.manage", "recommendations.review", "scoring.audit", "reports.access"],
  "Vice Chairperson": ["volunteers.manage", "events.manage", "recommendations.review", "scoring.audit", "reports.access"],
  Secretary: ["volunteers.manage", "events.manage", "reports.access"],
  "Assistant Secretary": ["volunteers.manage", "reports.access"],
  Treasurer: ["events.manage", "scoring.audit", "reports.access"],
  "Assistant Treasurer": ["scoring.audit", "reports.access"],
  Editor: ["events.manage", "reports.access"],
  Webmaster: ["events.manage", "reports.access"],
  "SB Lead": ["events.manage"],
  "SB Member": ["reports.access"],
};

export const DEFAULT_EVENT_ROLE_POWERS: Record<string, string[]> = {
  Chair: ["event.details", "event.committees", "event.roles", "event.forms", "event.reports"],
  "Vice Chair": ["event.details", "event.committees", "event.forms", "event.reports"],
  "Committee Lead": ["event.forms"],
  "Committee Member": [],
};

export function buildPermissionOverview(
  adminEmail: string,
  customPowers?: {
    eventRolePowers?: Record<string, string[]>;
    sbRolePowers?: Record<string, string[]>;
  },
): PermissionOverview {
  const sbPowerMap = customPowers?.sbRolePowers ?? DEFAULT_SB_ROLE_POWERS;
  const eventPowerMap = customPowers?.eventRolePowers ?? DEFAULT_EVENT_ROLE_POWERS;

  return {
    adminEmail,
    adminSource: "ADMIN_EMAIL",
    eventRoles: EVENT_ROLES.map((role) => ({
      notes:
        role === "Chair"
          ? "Event-level lead privilege. Multiple Chair assignments display as Co-chair. A volunteer may hold only one active role per event."
          : "Event-scoped responsibility controlled by Admin assignment. A volunteer may hold only one active role per event.",
      powers: eventPowerMap[role] ?? DEFAULT_EVENT_ROLE_POWERS[role] ?? [],
      role,
      scope: "event",
    })),
    notes: [
      "Admin is determined only by ADMIN_EMAIL and is not assigned through the database.",
      "Student Branch roles are term-scoped: a volunteer may hold only one active SB role per term.",
      "Event roles are scoped to a specific event: a volunteer may hold only one active role per event.",
      "Server-side route guards must be used for protected actions.",
    ],
    sbRoles: SB_ROLES.map((role) => ({
      notes: "Student Branch privilege assigned and revoked by the Admin account. Assigning a new role replaces any existing role for that term.",
      powers: sbPowerMap[role] ?? DEFAULT_SB_ROLE_POWERS[role] ?? [],
      role,
      scope: "student-branch",
    })),
  };
}
