"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { ID, Query, TablesDB } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { requireAuth, requireAdmin } from "@/features/access-control/server/current-user";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import { hasEventRole } from "@/features/access-control/lib/rules";
import { ROLE_BASE_POINTS } from "@/lib/config";
import { getServerEnv } from "@/lib/env";
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
import type {
  GradeRequest,
  GradeReview,
  PointLedgerEntry,
  TermScoringConfig,
  GradeAuditEntry,
} from "../types";


/**
 * Submits/Creates a grade request for a participant.
 * Scoped to Chair or Event Lead of the event (Chairs cannot grade their own event participants).
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

  if (graderId === validated.targetUserId) {
    throw new Error("You cannot grade yourself.");
  }

  if (!user.isAdmin) {
    const isLead = hasEventRole(user, validated.eventId, ["Chair", "Vice Chair", "Committee Lead"]);
    if (!isLead) {
      throw new Error("Only event leads and chairs can submit grading requests.");
    }


  }

  // Verify target has an active role in this event
  const eventRoleResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", validated.targetUserId),
      Query.equal("eventId", validated.eventId),
      Query.equal("active", true),
      Query.limit(1),
    ]
  );

  if (eventRoleResult.total === 0) {
    throw new Error("Target volunteer does not have an active responsibility assigned for this event.");
  }


  if (validated.gradeValue < 0 || validated.gradeValue > 10) {
    throw new Error("Grade value must be between 0 and 10.");
  }



  const requestId = `gr_${createHash("sha1").update(`${validated.eventId}:${validated.targetUserId}`).digest("hex").slice(0, 30)}`;
  const now = new Date().toISOString();

  // Check if finalized
  try {
    const existing = (await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      requestId
    )) as unknown as GradeRequest;

    if (existing.status === "finalized") {
      throw new Error("Cannot modify a finalized grade request.");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Cannot modify a finalized grade request.") {
      throw err;
    }
    // Otherwise, create request row
    await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeRequests,
      requestId,
      {
        requestId,
        eventId: validated.eventId,
        requestedBy: graderId,
        targetUserId: validated.targetUserId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }
    );
  }

  const reviewId = `rev_${createHash("sha1").update(`${requestId}:${graderId}`).digest("hex").slice(0, 28)}`;

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    );
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue: validated.gradeValue,
        submittedAt: now,
      }
    );
  } catch {
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
  if (user.isAdmin) {
    return rows;
  }

  const userEventIds = user.eventRoles.map((r) => r.eventId);
  return rows.filter((row) =>
    userEventIds.includes(row.eventId)
  );
}

/**
 * Submits or updates a grade review for a request.
 * Scoped to Admin, or authorized reviewer (own event). Chairs cannot grade own event.
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

  if (graderId === gradeRequest.targetUserId) {
    throw new Error("You cannot review your own grade request.");
  }

  if (gradeRequest.status === "finalized") {
    throw new Error("Cannot submit review for a finalized grade request.");
  }

  if (!user.isAdmin) {
    const hasRole = hasEventRole(user, gradeRequest.eventId, ["Chair", "Vice Chair", "Committee Lead"]);
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can submit reviews.");
    }
  }

  // Verify target role in event
  const eventRoleResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", gradeRequest.targetUserId),
      Query.equal("eventId", gradeRequest.eventId),
      Query.equal("active", true),
      Query.limit(1),
    ]
  );

  if (eventRoleResult.total === 0) {
    throw new Error("Target volunteer does not have an active responsibility assigned for this event.");
  }

  if (gradeValue < 0 || gradeValue > 10) {
    throw new Error("Grade value must be between 0 and 10.");
  }

  const reviewId = `rev_${createHash("sha1").update(`${gradeRequestId}:${graderId}`).digest("hex").slice(0, 28)}`;
  const now = new Date().toISOString();

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId
    );
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.gradeReviews,
      reviewId,
      {
        gradeValue,
        submittedAt: now,
      }
    );
  } catch {
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
  const now = new Date().toISOString();
  const term = deriveTermFromDate(conclusionApprovalDate);

  // Read all existing ledger entries for this event and target user
  const existingEntries = await tables.listRows(databaseId, APPWRITE_TABLES.pointLedger, [
    Query.equal("userId", gradeRequest.targetUserId),
    Query.equal("eventId", gradeRequest.eventId),
    Query.limit(100),
  ]);

  const existingRows = existingEntries.rows as unknown as PointLedgerEntry[];

  // Sum points for each source
  const currentGradePoints = existingRows
    .filter((r) => r.source === "grade")
    .reduce((acc, r) => acc + Number(r.points), 0);

  const currentRolePoints = existingRows
    .filter((r) => r.source === "role")
    .reduce((acc, r) => acc + Number(r.points), 0);

  // Create role point entry (lookup active event role assignment)
  const eventRoleResult = await tables.listRows(
    databaseId,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", gradeRequest.targetUserId),
      Query.equal("eventId", gradeRequest.eventId),
      Query.equal("active", true),
      Query.limit(1),
    ]
  );

  const role = eventRoleResult.total > 0 ? eventRoleResult.rows[0].role : null;
  const rolePoints = role ? (ROLE_BASE_POINTS[role as keyof typeof ROLE_BASE_POINTS] ?? 0) : 0;
  const targetRolePoints = rolePoints;

  const targetGradePoints = averageGrade;

  // Append grade adjustment if there is a difference
  const gradeDiff = targetGradePoints - currentGradePoints;
  if (gradeDiff !== 0) {
    await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
      userId: gradeRequest.targetUserId,
      eventId: gradeRequest.eventId,
      points: gradeDiff,
      conclusionApprovalDate,
      term,
      source: "grade",
      createdBy,
      createdAt: now,
    });
  }

  // Append role adjustment if there is a difference
  const roleDiff = targetRolePoints - currentRolePoints;
  if (roleDiff !== 0) {
    await tables.createRow(databaseId, APPWRITE_TABLES.pointLedger, ID.unique(), {
      userId: gradeRequest.targetUserId,
      eventId: gradeRequest.eventId,
      points: roleDiff,
      conclusionApprovalDate,
      term,
      source: "role",
      createdBy,
      createdAt: now,
    });
  }
}

/**
 * Finalizes a grade request. Averages all grader reviews, allocates points, and records ledger entries.
 * Scoped to Admin, Vice Chair, or Committee Lead only. Own-event grading restrictions apply.
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

  if (graderId === gradeRequest.targetUserId) {
    throw new Error("You cannot finalize your own grade request.");
  }

  if (gradeRequest.status === "finalized") {
    throw new Error("Grade request is already finalized.");
  }

  if (!user.isAdmin) {
    const hasRole = hasEventRole(user, gradeRequest.eventId, ["Chair", "Vice Chair", "Committee Lead"]);
    if (!hasRole) {
      throw new Error("Only authorized event reviewers or admins can finalize grades.");
    }
  }


  const approvalDate = new Date().toISOString();

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

  // Verify target role in event
  const eventRoleResult = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [
      Query.equal("userId", gradeRequest.targetUserId),
      Query.equal("eventId", gradeRequest.eventId),
      Query.equal("active", true),
      Query.limit(1),
    ]
  );

  if (eventRoleResult.total === 0) {
    throw new Error("Target volunteer does not have an active responsibility assigned for this event.");
  }

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
      : now;

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

  return JSON.parse(JSON.stringify(result.rows)) as PointLedgerEntry[];
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

  const existing = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.termScoringConfig,
    [
      Query.equal("userId", validated.userId),
      Query.equal("term", validated.term),
      Query.equal("year", validated.year),
      Query.limit(1),
    ]
  );

  if (existing.total > 0) {
    const row = await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      existing.rows[0].$id,
      {
        excludedFromTopBoard: validated.excluded,
        reason: validated.reason || "",
        setBy: changerId,
      }
    );
    return JSON.parse(JSON.stringify(row)) as TermScoringConfig;
  } else {
    const row = await tables.createRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.termScoringConfig,
      ID.unique(),
      {
        userId: validated.userId,
        term: validated.term,
        year: validated.year,
        excludedFromTopBoard: validated.excluded,
        reason: validated.reason || "",
        setBy: changerId,
      }
    );
    return JSON.parse(JSON.stringify(row)) as TermScoringConfig;
  }
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

  const [ledgerResult, configResult, profilesResult] = await Promise.all([
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
  ]);

  let entries = ledgerResult.rows as unknown as PointLedgerEntry[];
  const configs = configResult.rows as unknown as TermScoringConfig[];
  const profileMap = new Map(profilesResult.rows.map((p) => [p.$id, p]));

  let targetTerm = validated.term || "";
  let targetYear = validated.year || 0;

  if (validated.month !== undefined && validated.year !== undefined) {
    targetTerm = deriveTermFromDate(new Date(Date.UTC(validated.year, validated.month - 1, 1)).toISOString());
    targetYear = Number(targetTerm.split("/")[0]);
  } else if (validated.term !== undefined) {
    if (!validated.term.includes("/")) {
      const y = Number(validated.term);
      targetTerm = `${y}/${y + 1}`;
      targetYear = y;
    } else {
      targetTerm = validated.term;
      targetYear = Number(validated.term.split("/")[0]);
    }
  } else if (validated.year !== undefined) {
    targetTerm = `${validated.year}/${validated.year + 1}`;
    targetYear = validated.year;
  }

  // Filter ledger
  if (validated.month !== undefined && validated.year !== undefined) {
    entries = filterLedgerByMonth(entries, validated.month, validated.year);
  } else if (validated.term !== undefined) {
    entries = filterLedgerByTerm(entries, validated.term);
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
    );

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
  await requireAuth();

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
    const profiles = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      [Query.equal("$id", assignedUserIds), Query.limit(500)]
    );
    return profiles.rows.map((p) => ({
      id: p.$id,
      name: p.name || "Unknown Volunteer",
    }));
  }

  const profiles = await listProfiles();
  return profiles.map((p) => ({
    id: p.$id,
    name: p.name || "Unknown Volunteer",
  }));
}

export async function getVolunteerActiveEventRole(userId: string, eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  await requireAuth();

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

  const [reviewsResult, requestsResult, profilesResult] = await Promise.all([
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
  ]);

  const reviews = reviewsResult.rows as unknown as GradeReview[];
  const requests = requestsResult.rows as unknown as GradeRequest[];
  const profiles = profilesResult.rows as unknown as Profile[];

  const requestMap = new Map(requests.map((r) => [r.requestId, r]));
  const profileMap = new Map(profiles.map((p) => [p.$id, p]));

  return reviews.map((rev) => {
    const req = requestMap.get(rev.gradeRequestId);
    const targetUserId = req?.targetUserId || "";
    const eventId = req?.eventId || "";
    const volunteerName = profileMap.get(targetUserId)?.name || "Unknown Volunteer";
    const reviewerName = profileMap.get(rev.reviewerId)?.name || "Unknown Reviewer";

    return {
      $id: rev.$id,
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

  z.string().min(1).parse(gradeRequestId);

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
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.gradeRequests,
    gradeRequestId
  );
}

export async function listAllActiveEvents() {
  await requireAuth();
  const assignments = await listActiveEventRoleAssignments();
  const events = assignments.map((r) => ({
    eventId: r.eventId,
    eventTitle: r.eventTitle || r.eventId,
  }));
  const uniqueEvents = Array.from(new Map(events.map((e) => [e.eventId, e])).values());
  return uniqueEvents;
}
