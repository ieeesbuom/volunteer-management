"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { Query, TablesDB } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { requireAuth, requireAdmin } from "@/features/access-control/server/current-user";
import { listProfiles } from "@/features/access-control/server/profiles";
import { getActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import {
  eventIdMatchesStoredAssignment,
  hasEventRole,
  normalizeEventReference,
} from "@/features/access-control/lib/rules";
import { listEvents } from "@/features/events/server/event-service";
import { ROLE_BASE_POINTS } from "@/lib/config";
import { getServerEnv } from "@/lib/env";
import { isAppwriteNotFound } from "@/server/errors";
import type { AuditAction, Profile } from "@/features/access-control/types";

import {
  calculateAverageGrade,
  filterLedgerByMonth,
  filterLedgerByTerm,
  isEligibleForTopBoard,
  sumPointsFromLedger,
  deriveTermFromDate,
} from "../lib/helpers";
import {
  GradeRequestSchema,
  AdminGradeOverrideSchema,
  TermSchema,
  YearSchema,
  MonthSchema,
} from "../lib/schemas";
import {
  assertCanInspectVolunteerEventRole,
  assertCanListEventVolunteers,
} from "@/features/scoring/server/scoring-access";
import {
  removePointLedgerEntry,
  upsertPointLedgerEntry,
} from "@/features/scoring/server/point-ledger";
import type {
  GradeAuditEntry,
  GradeRequest,
  GradeReview,
  PointLedgerEntry,
  TermScoringConfig,
} from "../types";

type ConclusionReportRow = {
  $id: string;
  eventId: string;
  status: string;
};

type ReportApprovalRow = {
  $id: string;
  reportId: string;
  reviewedAt: string;
  status: string;
};

type SystemTopBoardExclusion = {
  active: boolean;
  revokedAt?: string | null;
  termId: string;
  userId: string;
};

type IeeeTermRow = {
  $id: string;
  label: string;
};

type ScoringRole = keyof typeof ROLE_BASE_POINTS;

function profileDisplayName(profile?: Profile) {
  return profile?.name || profile?.uomEmail || profile?.googleEmail || "Unknown Volunteer";
}

function resolveScoringRole(role?: string | null): ScoringRole | null {
  return role && role in ROLE_BASE_POINTS ? (role as ScoringRole) : null;
}

function resolveTargetScoringRole(
  assignment: { role?: string } | null,
) {
  return resolveScoringRole(assignment?.role);
}

async function requireActiveEventRoleAssignment(
  tables: TablesDB,
  databaseId: string,
  userId: string,
  eventId: string
) {
  const result = await tables.listRows(
    databaseId,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", userId),
      Query.equal("active", true),
      Query.limit(100),
    ]
  );

  const assignment = result.rows.find((row) =>
    eventIdMatchesStoredAssignment(String(row.eventId ?? ""), eventId),
  );

  if (!assignment) {
    throw new Error("Target volunteer does not have an active responsibility assigned for this event.");
  }

  return assignment as unknown as { role?: string };
}

function extraScoreRequestRowId(eventId: string, targetUserId: string) {
  return `gr_${createHash("sha1")
    .update(`${normalizeEventReference(eventId)}:${targetUserId}`)
    .digest("hex")
    .slice(0, 30)}`;
}

function scoringEventMatches(event: { $id: string; reference?: string }, eventId: string) {
  return (
    eventIdMatchesStoredAssignment(event.$id, eventId) ||
    Boolean(event.reference && eventIdMatchesStoredAssignment(event.reference, eventId))
  );
}

async function extraScoreEventIdCandidates(eventId: string) {
  const events = await listEvents();
  const match = events.find((event) => scoringEventMatches(event, eventId));

  return [
    ...new Set(
      [eventId, match?.$id, match?.reference].filter(
        (value): value is string => Boolean(value && value.trim()),
      ),
    ),
  ];
}

async function resolveCanonicalScoringEventId(eventId: string) {
  const events = await listEvents();
  const match = events.find((event) => scoringEventMatches(event, eventId));

  return match?.$id ?? eventId;
}

async function findExistingExtraScoreRequest(
  tables: TablesDB,
  databaseId: string,
  eventId: string,
  targetUserId: string,
) {
  const candidates = await extraScoreEventIdCandidates(eventId);

  for (const candidate of candidates) {
    try {
      const row = await tables.getRow(
        databaseId,
        APPWRITE_TABLES.gradeRequests,
        extraScoreRequestRowId(candidate, targetUserId),
      );
      return row as unknown as GradeRequest;
    } catch {
      // Look up by event + volunteer next.
    }
  }

  const result = await tables.listRows(databaseId, APPWRITE_TABLES.gradeRequests, [
    Query.equal("targetUserId", targetUserId),
    Query.limit(100),
  ]);

  return (
    (result.rows as unknown as GradeRequest[]).find((row) =>
      candidates.some((candidate) => eventIdMatchesStoredAssignment(row.eventId, candidate)),
    ) ?? null
  );
}

async function getApprovedConclusionApprovalDate(
  tables: TablesDB,
  databaseId: string,
  eventId: string
) {
  try {
    const reportsResult = await tables.listRows(
      databaseId,
      APPWRITE_TABLES.conclusionReports,
      [
        Query.equal("eventId", eventId),
        Query.equal("status", "APPROVED"),
        Query.limit(1),
      ]
    );

    if (reportsResult.total > 0) {
      const report = reportsResult.rows[0] as unknown as ConclusionReportRow;
      const approvalsResult = await tables.listRows(
        databaseId,
        APPWRITE_TABLES.reportApprovals,
        [
          Query.equal("reportId", report.$id),
          Query.equal("status", "APPROVED"),
          Query.orderDesc("reviewedAt"),
          Query.limit(1),
        ]
      );

      if (approvalsResult.total > 0) {
        const approval = approvalsResult.rows[0] as unknown as ReportApprovalRow;
        if (approval.reviewedAt) {
          return approval.reviewedAt;
        }
      }
    }
  } catch {
    // Fallthrough below
  }

  throw new Error(
    "Points can only be finalized after the event conclusion report is approved.",
  );
}

function termVariants(term: string) {
  const variants = new Set<string>();

  if (term) {
    variants.add(term);
  }

  const yyMatch = term.match(/^(\d{2})\/(\d{2})$/);
  if (yyMatch) {
    variants.add(`20${yyMatch[1]}/${yyMatch[2]}`);
    variants.add(`20${yyMatch[1]}/20${yyMatch[2]}`);
  }

  const fullMatch = term.match(/^(\d{4})\/(\d{4})$/);
  if (fullMatch) {
    variants.add(`${fullMatch[1]}/${fullMatch[2].slice(-2)}`);
    variants.add(`${fullMatch[1].slice(-2)}/${fullMatch[2].slice(-2)}`);
  }

  const shortMatch = term.match(/^(\d{4})\/(\d{2})$/);
  if (shortMatch) {
    variants.add(`${shortMatch[1]}/20${shortMatch[2]}`);
    variants.add(`${shortMatch[1].slice(-2)}/${shortMatch[2]}`);
  }

  const yearMatch = term.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    variants.add(`${year}/${year + 1}`);
    variants.add(`${year}/${String(year + 1).slice(-2)}`);
    variants.add(`${String(year).slice(-2)}/${String(year + 1).slice(-2)}`);
  }

  return variants;
}

function matchingSystemTermIds(targetTerm: string, terms: IeeeTermRow[]) {
  const variants = termVariants(targetTerm);
  return new Set(
    terms
      .filter((term) => variants.has(term.label) || variants.has(term.$id))
      .map((term) => term.$id)
  );
}

function isExcludedBySystemTopBoardSettings(
  userId: string,
  targetTerm: string,
  terms: IeeeTermRow[],
  exclusions: SystemTopBoardExclusion[]
) {
  const termIds = matchingSystemTermIds(targetTerm, terms);

  if (termIds.size === 0) {
    return false;
  }

  return exclusions.some(
    (exclusion) =>
      exclusion.userId === userId &&
      exclusion.active &&
      !exclusion.revokedAt &&
      termIds.has(exclusion.termId)
  );
}

async function assertEventEligibleForExtraScoring(
  tables: TablesDB,
  databaseId: string,
  eventId: string
) {
  let event: { status?: string } | null = null;
  try {
    event = (await tables.getRow(
      databaseId,
      APPWRITE_TABLES.events,
      eventId
    )) as unknown as { status?: string };
  } catch {
    // If event cannot be fetched or does not exist, let validation handle or check status below
  }

  const status = event?.status?.toLowerCase();
  if (!event || (status !== "pending_conclusion" && status !== "closed")) {
    throw new Error("Extra points to an event can only be given when the event is in PENDING_CONCLUSION or CLOSED status.");
  }
}

function assertCanSubmitExtraScore({
  eventId,
  eventReference,
  targetRole,
  user,
}: {
  eventId: string;
  eventReference?: string;
  targetRole: ScoringRole | null;
  user: Awaited<ReturnType<typeof requireAuth>>;
}) {
  if (user.isAdmin) {
    return;
  }

  if (targetRole === "Chair") {
    throw new Error("Only admins can submit extra scores for chairs.");
  }

  if (hasEventRole(user, eventId, ["Chair"], eventReference)) {
    return;
  }

  throw new Error("Only the event chair or an admin can submit extra scores.");
}

function assertCanFinalizeExtraScore({
  user,
}: {
  eventId?: string;
  targetRole?: ScoringRole | null;
  user: Awaited<ReturnType<typeof requireAuth>>;
}) {
  if (!user.isAdmin) {
    throw new Error("Only admins can approve extra scores.");
  }
}

/**
 * Submits/Creates a grade request for a participant.
 * Extra-score submission: Chairs score volunteers on their own events;
 * Admins score chairs (and anyone) and must approve all submissions.
 */
export async function createGradeRequest(data: {
  eventId: string;
  targetUserId: string;
  gradeValue: number;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  const validated = GradeRequestSchema.parse(data);
  const eventId = await resolveCanonicalScoringEventId(validated.eventId);

  if (graderId === validated.targetUserId) {
    throw new Error("You cannot grade yourself.");
  }

  await assertEventEligibleForExtraScoring(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    eventId
  );

  const targetAssignment = await requireActiveEventRoleAssignment(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    validated.targetUserId,
    eventId
  );
  const targetRole = resolveTargetScoringRole(targetAssignment);

  assertCanSubmitExtraScore({
    eventId,
    eventReference: validated.eventId,
    targetRole,
    user,
  });

  if (validated.gradeValue < 0 || validated.gradeValue > 10) {
    throw new Error("Grade value must be between 0 and 10.");
  }

  const existingRequest = await findExistingExtraScoreRequest(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    eventId,
    validated.targetUserId,
  );

  if (existingRequest) {
    throw new Error("An extra score evaluation has already been given to this volunteer for this event.");
  }

  const requestId = extraScoreRequestRowId(eventId, validated.targetUserId);
  const now = new Date().toISOString();

  await tables.createRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    requestId,
    {
      requestId,
      eventId,
      requestedBy: graderId,
      targetUserId: validated.targetUserId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }
  );

  const reviewId = `rev_${createHash("sha1").update(`${requestId}:${graderId}`).digest("hex").slice(0, 28)}`;

  let existingReview: GradeReview | null = null;
  try {
    existingReview = (await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    )) as unknown as GradeReview;
  } catch {
    existingReview = null;
  }

  if (existingReview) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue: validated.gradeValue,
        submittedAt: now,
      }
    );
  } else {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeRequestId: requestId,
        reviewerId: graderId,
        gradeValue: validated.gradeValue,
        submittedAt: now,
      }
    );
  }

  // Update status of grade request
  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    requestId,
    {
      status: "submitted",
      updatedAt: now,
    }
  );

  return JSON.parse(JSON.stringify(updatedRequest)) as GradeRequest;
}

export async function listGradeRequests(params?: { limit?: number; offset?: number }) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  const limit = params?.limit !== undefined ? z.number().int().min(1).max(500).parse(params.limit) : 500;
  const offset = params?.offset !== undefined ? z.number().int().min(0).parse(params.offset) : 0;

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("updatedAt"),
    ]
  );

  const rows = JSON.parse(JSON.stringify(result.rows)) as GradeRequest[];
  const [profiles, events, reviewsResult] = await Promise.all([
    listProfiles(),
    listEvents(),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      [Query.limit(1000)]
    ),
  ]);
  const reviewsByRequestId = new Map<string, number[]>();
  for (const row of reviewsResult.rows as unknown as GradeReview[]) {
    const list = reviewsByRequestId.get(row.gradeRequestId) ?? [];
    list.push(Number(row.gradeValue));
    reviewsByRequestId.set(row.gradeRequestId, list);
  }
  const profileMap = new Map(profiles.map((profile) => [profile.authUserId, profile]));
  const eventMap = new Map(events.map((event) => [event.$id, event]));
  const enrichedRows = rows.map((row) => {
    const grades = reviewsByRequestId.get(row.$id || row.requestId) || [];
    const avg = grades.length > 0 ? calculateAverageGrade(grades) : undefined;
    return {
      ...row,
      gradeValue: row.gradeValue !== undefined && row.gradeValue !== null ? row.gradeValue : avg,
      eventTitle: eventMap.get(row.eventId)?.title,
      requestedByName: profileDisplayName(profileMap.get(row.requestedBy)),
      targetUserName: profileDisplayName(profileMap.get(row.targetUserId)),
    };
  });

  if (user.isAdmin) {
    return enrichedRows;
  }

  return enrichedRows.filter((row) => {
    const event = eventMap.get(row.eventId);
    return hasEventRole(user, row.eventId, ["Chair"], event?.reference);
  });
}

/**
 * Submits or updates a grade review for a request.
 * Uses the same extra-score hierarchy as request creation.
 */
export async function submitGradeReview(gradeRequestId: string, gradeValue: number) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  z.string().min(1).parse(gradeRequestId);
  z.number().int().min(0).max(10).parse(gradeValue);

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  await assertEventEligibleForExtraScoring(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.eventId
  );

  if (graderId === gradeRequest.targetUserId) {
    throw new Error("You cannot review your own grade request.");
  }

  if (gradeRequest.status === "finalized") {
    throw new Error("Cannot submit review for a finalized grade request.");
  }

  const targetAssignment = await requireActiveEventRoleAssignment(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.targetUserId,
    gradeRequest.eventId
  );
  const targetRole = resolveTargetScoringRole(targetAssignment);

  assertCanSubmitExtraScore({ eventId: gradeRequest.eventId, targetRole, user });

  if (gradeValue < 0 || gradeValue > 10) {
    throw new Error("Grade value must be between 0 and 10.");
  }

  const reviewId = `rev_${createHash("sha1").update(`${gradeRequestId}:${graderId}`).digest("hex").slice(0, 28)}`;
  const now = new Date().toISOString();

  let existingReview: GradeReview | null = null;
  try {
    existingReview = (await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    )) as unknown as GradeReview;
  } catch {
    existingReview = null;
  }

  if (existingReview) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue,
        submittedAt: now,
      }
    );
  } else {
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeRequestId,
        reviewerId: graderId,
        gradeValue,
        submittedAt: now,
      }
    );
  }

  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
    {
      status: "reviewed",
      updatedAt: now,
    }
  );

  return JSON.parse(JSON.stringify(updatedRequest)) as GradeRequest;
}

/**
 * Recalculate points ledger entries for a finalized request.
 * Delta-based and append-only to preserve manual adjustments and audit history.
 */
async function recalculateLedgerEntries(
  tables: TablesDB,
  databaseId: string,
  gradeRequest: GradeRequest,
  averageGrade: number,
  conclusionApprovalDate: string,
  createdBy: string
) {
  await upsertPointLedgerEntry({
    conclusionApprovalDate,
    createdBy,
    databaseId,
    eventId: gradeRequest.eventId,
    points: averageGrade,
    source: "grade",
    tables,
    userId: gradeRequest.targetUserId,
  });
}

/**
 * Finalizes an extra-score request. Averages submitted scores and records grade ledger deltas.
 * Event role/base points are finalized separately when the conclusion report is approved.
 */
export async function finalizeGrade(gradeRequestId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  const graderId = user.authUser.id;

  z.string().min(1).parse(gradeRequestId);

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  )) as unknown as GradeRequest;

  await assertEventEligibleForExtraScoring(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.eventId
  );

  if (graderId === gradeRequest.targetUserId) {
    throw new Error("You cannot finalize your own grade request.");
  }

  if (gradeRequest.status === "finalized") {
    throw new Error("Grade request is already finalized.");
  }

  const targetAssignment = await requireActiveEventRoleAssignment(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.targetUserId,
    gradeRequest.eventId
  );
  const targetRole = resolveTargetScoringRole(targetAssignment);

  assertCanFinalizeExtraScore({ eventId: gradeRequest.eventId, targetRole, user });

  const approvalDate = await getApprovedConclusionApprovalDate(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.eventId
  );

  // Fetch all reviews
  const reviewsResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    [Query.equal("gradeRequestId", gradeRequestId), Query.limit(100)]
  );

  if (reviewsResult.total === 0) {
    throw new Error("Cannot finalize grade request with zero reviews.");
  }

  const reviews = reviewsResult.rows as unknown as GradeReview[];
  const grades = reviews.map((r) => r.gradeValue);
  const averageGrade = calculateAverageGrade(grades);

  // Recalculate ledger entries (delta-based)
  await recalculateLedgerEntries(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest,
    averageGrade,
    approvalDate,
    graderId
  );

  // Update status of grade request
  const updatedRequest = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
    {
      status: "finalized",
      updatedAt: new Date().toISOString(),
    }
  );

  return JSON.parse(JSON.stringify(updatedRequest)) as GradeRequest;
}

async function syncRoleLedgerEntry({
  createdBy,
  databaseId,
  eventId,
  assignment,
  tables,
  conclusionApprovalDate,
}: {
  createdBy: string;
  databaseId: string;
  eventId: string;
  assignment: { userId: string; role?: string };
  tables: TablesDB;
  conclusionApprovalDate: string;
}) {
  const role = resolveTargetScoringRole(assignment);

  if (!role) {
    return { changed: false, skipped: true };
  }

  await upsertPointLedgerEntry({
    conclusionApprovalDate,
    createdBy,
    databaseId,
    eventId,
    points: ROLE_BASE_POINTS[role],
    source: "role",
    tables,
    userId: assignment.userId,
  });

  return { changed: true, skipped: false };
}

export async function finalizeEventRolePoints(eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAdmin();
  const validatedEventId = z.string().min(1).parse(eventId);
  const databaseId = env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const conclusionApprovalDate = await getApprovedConclusionApprovalDate(
    tables,
    databaseId,
    validatedEventId
  );

  const assignmentsResult = await tables.listRows(
    databaseId,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("eventId", validatedEventId),
      Query.equal("active", true),
      Query.limit(500),
    ]
  );
  const assignments = assignmentsResult.rows as unknown as Array<{ userId: string; role?: string }>;
  let finalized = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    const result = await syncRoleLedgerEntry({
      conclusionApprovalDate,
      createdBy: user.authUser.id,
      databaseId,
      eventId: validatedEventId,
      assignment,
      tables,
    });

    if (result.skipped) {
      skipped += 1;
    } else if (result.changed) {
      finalized += 1;
    } else {
      unchanged += 1;
    }
  }

  await writeAuditLog({
    action: "EVENT_ROLE_POINTS_FINALIZED" as unknown as AuditAction,
    actorUserId: user.authUser.id,
    metadata: {
      eventId: validatedEventId,
      finalized,
      skipped,
      unchanged,
    },
    targetId: validatedEventId,
    targetType: "event",
  });

  return { eventId: validatedEventId, finalized, skipped, unchanged };
}

/**
 * Admin override for any grade review. Captures audit logs, preserves original value, and adjusts ledger if finalized.
 */
export async function adminOverrideGrade(
  gradeReviewId: string,
  newGradeValue: number,
  reason?: string
) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAdmin();
  const changerId = user.authUser.id;

  const validated = AdminGradeOverrideSchema.parse({
    gradeReviewId,
    newGradeValue,
    reason,
  });

  const review = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    validated.gradeReviewId
  )) as unknown as GradeReview;

  const gradeRequest = (await tables.getRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    review.gradeRequestId
  )) as unknown as GradeRequest;

  await assertEventEligibleForExtraScoring(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.eventId
  );

  await requireActiveEventRoleAssignment(
    tables,
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    gradeRequest.targetUserId,
    gradeRequest.eventId
  );

  if (validated.newGradeValue < 0 || validated.newGradeValue > 10) {
    throw new Error("Grade value must be between 0 and 10.");
  }

  const originalValue = review.gradeValue;
  const now = new Date().toISOString();

  const auditEntry: GradeAuditEntry = {
    originalValue,
    newValue: validated.newGradeValue,
    changedBy: changerId,
    changedAt: now,
    reason: validated.reason,
  };

  let auditList: GradeAuditEntry[] = [];
  if (review.audit_metadata) {
    try {
      auditList = JSON.parse(review.audit_metadata);
      if (!Array.isArray(auditList)) {
        auditList = [];
      }
    } catch {
      auditList = [];
    }
  }
  auditList.push(auditEntry);

  // Update review value and audit list
  const updatedReview = await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    validated.gradeReviewId,
    {
      gradeValue: validated.newGradeValue,
      audit_metadata: JSON.stringify(auditList),
    }
  );

  // Write systemic audit log
  await writeAuditLog({
    action: "GRADE_OVERRIDDEN" as unknown as AuditAction,
    actorUserId: changerId,
    metadata: {
      gradeReviewId: validated.gradeReviewId,
      originalValue,
      newValue: validated.newGradeValue,
      reason: validated.reason,
    },
    targetId: review.gradeRequestId,
    targetType: "grade_request",
  });

  // Recalculate average grade and update point ledger if finalized
  if (gradeRequest.status === "finalized") {
    const reviewsResult = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      [Query.equal("gradeRequestId", review.gradeRequestId), Query.limit(100)]
    );
    const updatedReviews = reviewsResult.rows as unknown as GradeReview[];
    const grades = updatedReviews.map((r) => r.gradeValue);
    const newAverage = calculateAverageGrade(grades);

    // Get current finalized date from point_ledger
    const existingLedger = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.pointLedger,
      [
        Query.equal("userId", gradeRequest.targetUserId),
        Query.equal("eventId", gradeRequest.eventId),
        Query.equal("source", "grade"),
        Query.limit(1),
      ]
    );

    const approvalDate = existingLedger.total > 0
      ? existingLedger.rows[0].conclusionApprovalDate
      : await getApprovedConclusionApprovalDate(
          tables,
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          gradeRequest.eventId
        );

    await recalculateLedgerEntries(
      tables,
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      gradeRequest,
      newAverage,
      approvalDate,
      changerId
    );
  }

  return JSON.parse(JSON.stringify(updatedReview)) as GradeReview;
}

/**
 * Fetches point ledger entries for a volunteer. Scoped to Admin or Self.
 */
export async function getVolunteerPoints(userId: string, params?: { limit?: number; offset?: number }) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();

  z.string().min(1).parse(userId);
  const limit = params?.limit !== undefined ? z.number().int().min(1).max(500).parse(params.limit) : 500;
  const offset = params?.offset !== undefined ? z.number().int().min(0).parse(params.offset) : 0;

  if (!user.isAdmin && user.authUser.id !== userId) {
    throw new Error("Unauthorized access to point ledger.");
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.pointLedger,
    [
      Query.equal("userId", userId),
      Query.limit(limit),
      Query.offset(offset),
    ]
  );

  const rows = JSON.parse(JSON.stringify(result.rows)) as PointLedgerEntry[];
  const [profiles, events] = await Promise.all([listProfiles(), listEvents()]);
  const profileMap = new Map(profiles.map((profile) => [profile.authUserId, profile]));
  const eventMap = new Map(events.map((event) => [event.$id, event]));

  return rows.map((row) => ({
    ...row,
    createdByName: profileDisplayName(profileMap.get(row.createdBy)),
    eventTitle: eventMap.get(row.eventId)?.title,
  }));
}

function termScoringConfigRowId(userId: string, term: string, year: number) {
  const seed = `${userId}:${term}:${year}`;

  return `tsc_${createHash("sha1").update(seed).digest("hex").slice(0, 28)}`;
}

/**
 * Configures Top Board exclusions for a user. Admin-only.
 */
export async function toggleTopBoardExclusion(data: {
  userId: string;
  term: string;
  year: number;
  excluded: boolean;
  reason?: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAdmin();
  const changerId = user.authUser.id;

  const validated = z.object({
    userId: z.string().min(1),
    term: TermSchema,
    year: YearSchema,
    excluded: z.boolean(),
    reason: z.string().optional(),
  }).parse(data);

  const rowId = termScoringConfigRowId(validated.userId, validated.term, validated.year);

  try {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      rowId,
      {
        excludedFromTopBoard: validated.excluded,
        reason: validated.reason || "",
        setBy: changerId,
      },
    );
    return JSON.parse(JSON.stringify(row)) as TermScoringConfig;
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  const row = await tables.createRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.termScoringConfig,
    rowId,
    {
      excludedFromTopBoard: validated.excluded,
      reason: validated.reason || "",
      setBy: changerId,
      term: validated.term,
      userId: validated.userId,
      year: validated.year,
    },
  );
  return JSON.parse(JSON.stringify(row)) as TermScoringConfig;
}

/**
 * Fetches the ranked leaderboard, filtered by term, month, and/or year.
 */
export async function getLeaderboard(params: {
  term?: string;
  month?: number;
  year?: number;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  await requireAuth();

  const validated = z.object({
    term: TermSchema.optional(),
    month: MonthSchema.optional(),
    year: YearSchema.optional(),
  }).parse(params);

  const [ledgerResult, configResult, profilesResult, exclusionResult, termsResult] = await Promise.all([
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.pointLedger,
      [Query.limit(1000)]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      [Query.limit(1000)]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      [Query.limit(500)]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.topBoardExclusions,
      [Query.equal("active", true), Query.limit(1000)]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.ieeeTerms,
      [Query.limit(100)]
    ),
  ]);

  let entries = ledgerResult.rows as unknown as PointLedgerEntry[];
  const configs = configResult.rows as unknown as TermScoringConfig[];
  const exclusions = exclusionResult.rows as unknown as SystemTopBoardExclusion[];
  const terms = termsResult.rows as unknown as IeeeTermRow[];
  const profileMap = new Map(profilesResult.rows.map((p) => [p.$id, p]));

  let targetTerm = validated.term || "";
  let targetYear = validated.year || 0;

  if (validated.month !== undefined && validated.year !== undefined) {
    targetTerm = deriveTermFromDate(new Date(Date.UTC(validated.year, validated.month - 1, 1)).toISOString());
    const parsed = Number(targetTerm.split("/")[0]);
    targetYear = parsed < 100 ? 2000 + parsed : parsed;
  } else if (validated.term !== undefined) {
    if (!validated.term.includes("/")) {
      const y = Number(validated.term);
      targetTerm = `${String(y).slice(-2)}/${String(y + 1).slice(-2)}`;
      targetYear = y;
    } else {
      targetTerm = validated.term;
      const parsed = Number(validated.term.split("/")[0]);
      targetYear = parsed < 100 ? 2000 + parsed : parsed;
    }
  } else if (validated.year !== undefined) {
    targetTerm = `${String(validated.year).slice(-2)}/${String(validated.year + 1).slice(-2)}`;
    targetYear = validated.year;
  } else {
    targetTerm = deriveTermFromDate(new Date().toISOString());
    const parsed = Number(targetTerm.split("/")[0]);
    targetYear = parsed < 100 ? 2000 + parsed : parsed;
  }

  // Filter ledger
  if (validated.month !== undefined && validated.year !== undefined) {
    entries = filterLedgerByMonth(entries, validated.month, validated.year);
  } else if (targetTerm) {
    entries = filterLedgerByTerm(entries, targetTerm);
  }

  // Aggregate user points
  const userMap = new Map<string, PointLedgerEntry[]>();
  for (const entry of entries) {
    if (!userMap.has(entry.userId)) {
      userMap.set(entry.userId, []);
    }
    userMap.get(entry.userId)!.push(entry);
  }

  const leaderboard: { userId: string; name: string; points: number }[] = [];

  for (const [userId, userEntries] of userMap.entries()) {
    const isEligible = isEligibleForTopBoard(
      userId,
      targetTerm,
      targetYear,
      configs
    ) && !isExcludedBySystemTopBoardSettings(userId, targetTerm, terms, exclusions);

    if (isEligible) {
      const totalPoints = sumPointsFromLedger(userEntries);
      const name = profileMap.get(userId)?.name || "Unknown Volunteer";
      leaderboard.push({ userId, name, points: totalPoints });
    }
  }

  // Sort descending by points
  return leaderboard.sort((a, b) => b.points - a.points);
}

/**
 * Lists all volunteer profiles as simple ID and name pairs for dropdown selection.
 */
export async function listVolunteers(eventId?: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  assertCanListEventVolunteers(user, eventId);

  if (eventId) {
    const assignments = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.eventRoleAssignments,
      [Query.equal("eventId", eventId), Query.equal("active", true), Query.limit(500)]
    );
    const assignedUserIds = assignments.rows.map((row) => row.userId);
    if (assignedUserIds.length === 0) {
      return [];
    }
    const uniqueUserIds = Array.from(new Set(assignedUserIds));
    if (uniqueUserIds.length <= 100) {
      const profiles = await tables.listRows(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.profiles,
        [Query.equal("$id", uniqueUserIds), Query.limit(500)]
      );
      return profiles.rows.map((p) => ({
        id: p.$id,
        email: p.uomEmail || p.googleEmail || "",
        name: profileDisplayName(p as unknown as Profile),
      }));
    } else {
      const allProfiles = await listProfiles();
      const userSet = new Set(uniqueUserIds);
      return allProfiles
        .filter((p) => userSet.has(p.$id))
        .map((p) => ({
          id: p.$id,
          email: p.uomEmail || p.googleEmail || "",
          name: profileDisplayName(p),
        }));
    }
  }

  const profiles = await listProfiles();
  return profiles.map((p) => ({
    id: p.$id,
    email: p.uomEmail || p.googleEmail || "",
    name: profileDisplayName(p),
  }));
}

export async function getVolunteerActiveEventRole(userId: string, eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const user = await requireAuth();
  assertCanInspectVolunteerEventRole(user, userId, eventId);

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", userId),
      Query.equal("eventId", eventId),
      Query.equal("active", true),
      Query.limit(1),
    ]
  );

  return result.total > 0 ? result.rows[0].role : null;
}

/**
 * Lists all grade reviews with detailed volunteer and reviewer names. Admin-only.
 */
export async function listDetailedReviews() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  await requireAdmin();

  const [reviewsResult, requestsResult, profilesResult, events] = await Promise.all([
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      [Query.limit(500), Query.orderDesc("submittedAt")]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      [Query.limit(500)]
    ),
    tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      [Query.limit(500)]
    ),
    listEvents(),
  ]);

  const reviews = reviewsResult.rows as unknown as GradeReview[];
  const requests = requestsResult.rows as unknown as GradeRequest[];
  const profiles = profilesResult.rows as unknown as Profile[];

  const requestMap = new Map(requests.map((r) => [r.requestId, r]));
  const profileMap = new Map(profiles.map((p) => [p.$id, p]));
  const eventMap = new Map(events.map((event) => [event.$id, event]));

  return reviews.map((rev) => {
    const req = requestMap.get(rev.gradeRequestId);
    const targetUserId = req?.targetUserId || "";
    const eventId = req?.eventId || "";
    const volunteerName = profileDisplayName(profileMap.get(targetUserId));
    const reviewerName = profileDisplayName(profileMap.get(rev.reviewerId));

    return {
      $id: rev.$id,
      eventTitle: eventMap.get(eventId)?.title,
      gradeRequestId: rev.gradeRequestId,
      reviewerId: rev.reviewerId,
      reviewerName,
      volunteerName,
      eventId,
      gradeValue: rev.gradeValue,
      submittedAt: rev.submittedAt,
      audit_metadata: rev.audit_metadata,
    };
  });
}

/**
 * Deletes/rejects a grade request and its corresponding reviews. Admin-only.
 */
export async function deleteGradeRequest(gradeRequestId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  await requireAdmin();
  const databaseId = env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

  z.string().min(1).parse(gradeRequestId);

  const gradeRequest = (await tables.getRow(
    databaseId,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
  )) as unknown as GradeRequest;

  // Delete reviews first
  const reviewsResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeReviews,
    [Query.equal("gradeRequestId", gradeRequestId), Query.limit(100)]
  );

  for (const review of reviewsResult.rows) {
    await tables.deleteRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      review.$id
    );
  }

  // Delete request
  await tables.deleteRow(
    databaseId,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId,
  );

  await removePointLedgerEntry({
    databaseId,
    eventId: gradeRequest.eventId,
    source: "grade",
    tables,
    userId: gradeRequest.targetUserId,
  });
}

export async function listAllActiveEvents() {
  const user = await requireAuth();
  const assignments = await getActiveEventRoleAssignments(user.authUser.id);
  const scopedAssignments = user.isAdmin
    ? assignments
    : assignments.filter((assignment) => assignment.role === "Chair");
  const events = scopedAssignments.map((r) => ({
    eventId: r.eventId,
    eventTitle: r.eventTitle || r.eventId,
  }));
  const uniqueEvents = Array.from(new Map(events.map((e) => [e.eventId, e])).values());
  return uniqueEvents;
}
