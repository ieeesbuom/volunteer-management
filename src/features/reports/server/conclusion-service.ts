import "server-only";

import { ID, Query, type Models } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  hasEventRole,
  normalizeEventReference,
} from "@/features/access-control/lib/rules";
import type { SessionUser } from "@/features/access-control/types";
import {
  canApproveReport,
  canEditReportContent,
  canSubmitReport,
  canTransitionReportStatus,
  hasRequiredContent,
} from "@/features/reports/lib/approval-rules";
import type {
  ApproveConclusionReportInput,
  CreateConclusionReportInput,
  DraftContentInput,
  UpdateConclusionReportInput,
} from "@/features/reports/lib/validation";
import type { ConclusionReport, ConclusionReportContent, ReportApproval } from "@/features/reports/types";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import {
  getAdminNotificationRecipientIds,
  getEventNotificationContext,
} from "@/features/notifications/server/workflow-recipients";
import { isAppwriteNotFound, ValidationError } from "@/server/errors";
import {
  getEventById,
  syncEventConclusionReviewed,
  syncEventConclusionSubmitted,
} from "@/features/events/server/event-service";
import {
  notifyEventUpdateWorkflow,
  notifyReportApprovalWorkflow,
} from "@/features/notifications/server/workflow-notifications";
import { finalizeEventRolePoints } from "@/features/scoring/server/actions";
import {
  downloadConclusionReportFile,
  conclusionReportFileId,
  uploadConclusionReportFile,
} from "@/features/reports/server/conclusion-attachment";

type AppRow = Models.Row & Record<string, unknown>;

const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const;
const CONTENT_COLUMN_MAX_LENGTH = 12000;

function emptyContent(): ConclusionReportContent {
  return {
    additionalInfo: "",
  };
}

type LegacyConclusionContent = Partial<ConclusionReportContent> & {
  attendanceNotes?: string;
  challenges?: string;
  objectives?: string;
  outcomes?: string;
  recommendations?: string;
};

function legacyContentToAdditionalInfo(parsed: LegacyConclusionContent) {
  const sections = [
    parsed.objectives ? `Objectives:\n${parsed.objectives}` : "",
    parsed.outcomes ? `Outcomes:\n${parsed.outcomes}` : "",
    parsed.challenges ? `Challenges:\n${parsed.challenges}` : "",
    parsed.recommendations ? `Recommendations:\n${parsed.recommendations}` : "",
    parsed.attendanceNotes ? `Attendance notes:\n${parsed.attendanceNotes}` : "",
  ].filter(Boolean);

  return sections.join("\n\n");
}

function normalizeContentFields(parsed: LegacyConclusionContent): ConclusionReportContent {
  return {
    additionalInfo: parsed.additionalInfo ?? legacyContentToAdditionalInfo(parsed),
    reportFileId: parsed.reportFileId,
    reportFileName: parsed.reportFileName,
  };
}

function contentFromLegacyColumns(row: AppRow): ConclusionReportContent {
  return normalizeContentFields({
    attendanceNotes: String(row.attendanceNotes ?? ""),
    challenges: String(row.challenges ?? ""),
    objectives: String(row.objectives ?? ""),
    outcomes: String(row.outcomes ?? ""),
    recommendations: String(row.recommendations ?? ""),
  });
}

function hasLegacyColumnContent(row: AppRow) {
  return (
    typeof row.attendanceNotes === "string" ||
    typeof row.challenges === "string" ||
    typeof row.objectives === "string" ||
    typeof row.outcomes === "string" ||
    typeof row.recommendations === "string"
  );
}

function parseStoredContent(row: AppRow): ConclusionReportContent | null {
  if (typeof row.content !== "string" || !row.content) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.content) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeContentFields(parsed as LegacyConclusionContent);
    }
  } catch {
    // Fall back to legacy columns or plain-text content below.
  }

  return null;
}

function toContent(row: AppRow): ConclusionReportContent {
  const parsedContent = parseStoredContent(row);

  if (parsedContent) {
    return parsedContent;
  }

  if (typeof row.content === "string" && row.content) {
    if (hasLegacyColumnContent(row)) {
      return contentFromLegacyColumns(row);
    }

    return {
      ...emptyContent(),
      additionalInfo: row.content,
    };
  }

  return contentFromLegacyColumns(row);
}

function contentToRow(content: ConclusionReportContent) {
  const serialized = JSON.stringify(content);

  if (serialized.length > CONTENT_COLUMN_MAX_LENGTH) {
    throw new Error("Report content is too long to save.");
  }

  return { content: serialized };
}

export function toConclusionReport(row: AppRow): ConclusionReport {
  return {
    $id: row.$id,
    content: toContent(row),
    createdAt: String(row.createdAt),
    eventId: String(row.eventId),
    eventTitle: String(row.eventTitle),
    status: String(row.status) as ConclusionReport["status"],
    submittedAt:
      typeof row.submittedAt === "string" && row.submittedAt ? row.submittedAt : undefined,
    submittedBy: String(row.submittedBy),
    submittedByName: String(row.submittedByName),
    updatedAt: String(row.updatedAt),
  };
}

export function toReportApproval(row: AppRow): ReportApproval {
  return {
    $id: row.$id,
    reportId: String(row.reportId),
    reviewNote:
      typeof row.reviewNote === "string" && row.reviewNote ? row.reviewNote : undefined,
    reviewedAt: String(row.reviewedAt),
    reviewedBy: String(row.reviewedBy),
    reviewedByName: String(row.reviewedByName),
    status: String(row.status) as ReportApproval["status"],
  };
}

async function resolveEventTitle(user: SessionUser, eventId: string) {
  const normalizedEventId = normalizeEventReference(eventId);
  let event: Awaited<ReturnType<typeof getEventById>> = null;

  try {
    event = await getEventById(normalizedEventId);
  } catch {
    event = null;
  }

  if (event) {
    return event.title;
  }

  const assignment = user.eventRoles.find(
    (entry) =>
      entry.active && normalizeEventReference(entry.eventId) === normalizedEventId,
  );

  if (assignment?.eventTitle) {
    return assignment.eventTitle;
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.eventRoleAssignments,
    [Query.equal("eventId", normalizedEventId), Query.equal("active", true), Query.limit(1)],
    undefined,
    false,
  );
  const row = result.rows[0] as AppRow | undefined;

  if (row && typeof row.eventTitle === "string" && row.eventTitle) {
    return String(row.eventTitle);
  }

  throw new Error("Event title could not be resolved for the selected event.");
}

export function canManageConclusionReport(
  user: SessionUser,
  eventId: string,
  eventReference?: string,
) {
  return (
    user.isAdmin ||
    hasEventRole(user, eventId, [...EVENT_LEAD_ROLES], eventReference)
  );
}

export function canViewConclusionReport(user: SessionUser, report: ConclusionReport) {
  if (user.isAdmin) {
    return true;
  }

  if (report.submittedBy === user.authUser.id) {
    return true;
  }

  return hasEventRole(user, report.eventId, [...EVENT_LEAD_ROLES]);
}

async function getConclusionReportRow(reportId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.conclusionReports,
      reportId,
    );

    return row as AppRow;
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function listConclusionReports() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    [Query.orderDesc("updatedAt"), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toConclusionReport(row as AppRow));
}

export async function listConclusionReportsForUser(user: SessionUser) {
  const reports = await listConclusionReports();
  return reports.filter((report) => canViewConclusionReport(user, report));
}

export async function getConclusionReport(reportId: string) {
  const row = await getConclusionReportRow(reportId);
  return row ? toConclusionReport(row) : null;
}

export async function getConclusionReportByEvent(eventId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const normalizedEventId = normalizeEventReference(eventId);
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    [Query.equal("eventId", normalizedEventId), Query.limit(1)],
    undefined,
    false,
  );

  const row = result.rows[0] as AppRow | undefined;
  return row ? toConclusionReport(row) : null;
}

export async function getReportApproval(reportId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.reportApprovals,
    [Query.equal("reportId", reportId), Query.orderDesc("reviewedAt"), Query.limit(1)],
    undefined,
    false,
  );

  const row = result.rows[0] as AppRow | undefined;
  return row ? toReportApproval(row) : null;
}

function mergeDraftContent(
  current: ConclusionReportContent,
  input?: DraftContentInput,
): ConclusionReportContent {
  if (!input) {
    return current;
  }

  return {
    additionalInfo: input.additionalInfo ?? current.additionalInfo,
    reportFileId: input.reportFileId ?? current.reportFileId,
    reportFileName: input.reportFileName ?? current.reportFileName,
  };
}

export async function createConclusionReportRecord(
  user: SessionUser,
  input: CreateConclusionReportInput,
) {
  if (!canManageConclusionReport(user, input.eventId)) {
    throw new Error("Required event role is missing.");
  }

  const normalizedEventId = normalizeEventReference(input.eventId);
  const existing = await getConclusionReportByEvent(normalizedEventId);

  if (existing) {
    throw new Error("A conclusion report already exists for this event.");
  }

  const now = new Date().toISOString();
  const eventTitle = await resolveEventTitle(user, normalizedEventId);
  const content = mergeDraftContent(emptyContent(), input.content);
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    ID.unique(),
    {
      ...contentToRow(content),
      createdAt: now,
      eventId: normalizedEventId,
      eventTitle,
      status: "DRAFT",
      submittedBy: user.authUser.id,
      submittedByName: user.authUser.name || user.authUser.email,
      updatedAt: now,
    },
  );

  await writeAuditLog({
    action: "CONCLUSION_REPORT_CREATED",
    actorUserId: user.authUser.id,
    metadata: { eventId: normalizedEventId, eventTitle },
    targetId: row.$id,
    targetType: "conclusion_report",
  });

  return toConclusionReport(row);
}

async function updateConclusionReportRow(
  reportId: string,
  payload: Record<string, unknown>,
) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.conclusionReports,
    reportId,
    {
      ...payload,
      updatedAt: new Date().toISOString(),
    },
  );

  return toConclusionReport(row);
}

export async function updateConclusionReportRecord(
  user: SessionUser,
  reportId: string,
  input: UpdateConclusionReportInput,
) {
  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canManageConclusionReport(user, report.eventId)) {
    throw new Error("Required event role is missing.");
  }

  if (input.content && !canEditReportContent(report)) {
    throw new Error("Submitted and approved reports cannot be edited.");
  }

  if (input.status && !canTransitionReportStatus(report.status, input.status)) {
    throw new Error(`Cannot move report from ${report.status} to ${input.status}.`);
  }

  const nextContent = mergeDraftContent(report.content, input.content);
  const draftLike = { ...report, content: nextContent };

  if (input.status === "SUBMITTED" && !canSubmitReport(draftLike)) {
    throw new Error("Report content is incomplete and cannot be submitted.");
  }

  const payload: Record<string, unknown> = {
    ...contentToRow(nextContent),
  };

  if (input.status) {
    payload.status = input.status;

    if (input.status === "SUBMITTED") {
      payload.submittedAt = new Date().toISOString();
    }
  }

  const updated = await updateConclusionReportRow(reportId, payload);

  if (input.status === "SUBMITTED") {
    await syncEventConclusionSubmitted(report.eventId, user.authUser.id);
    const adminRecipientUserIds = await getAdminNotificationRecipientIds({
      excludeUserIds: [user.authUser.id],
    });
    await notifyEventUpdateWorkflow({
      actorUserId: user.authUser.id,
      eventId: report.eventId,
      eventTitle: updated.eventTitle,
      linkHref: "/reports/conclusions",
      message: `${updated.eventTitle} conclusion report was submitted for review.`,
      recipientUserIds: adminRecipientUserIds,
    });
  }

  await writeAuditLog({
    action: "CONCLUSION_REPORT_UPDATED",
    actorUserId: user.authUser.id,
    metadata: {
      eventId: report.eventId,
      status: updated.status,
    },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return updated;
}

export async function attachConclusionReportPdf(
  user: SessionUser,
  reportId: string,
  bytes: Buffer,
  originalFilename: string,
) {
  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canManageConclusionReport(user, report.eventId)) {
    throw new Error("Required event role is missing.");
  }

  if (!canEditReportContent(report)) {
    throw new Error("Submitted and approved reports cannot be edited.");
  }

  const fileId = conclusionReportFileId(reportId);
  await uploadConclusionReportFile({
    bytes,
    fileId,
    filename: originalFilename,
  });

  const nextContent: ConclusionReportContent = {
    ...report.content,
    reportFileId: fileId,
    reportFileName: originalFilename.trim() || "report.pdf",
  };

  const updated = await updateConclusionReportRow(reportId, contentToRow(nextContent));

  await writeAuditLog({
    action: "CONCLUSION_REPORT_UPDATED",
    actorUserId: user.authUser.id,
    metadata: { attachmentUpdated: true, eventId: report.eventId, fileId },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return updated;
}

export async function resolveConclusionReportPdf(report: ConclusionReport) {
  if (!report.content.reportFileId) {
    return null;
  }

  try {
    return await downloadConclusionReportFile(report.content.reportFileId);
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    throw new ValidationError("Uploaded report file could not be found.");
  }
}

export async function reopenConclusionReportRecord(user: SessionUser, reportId: string) {
  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (report.status === "DRAFT") {
    return report;
  }

  if (!canTransitionReportStatus(report.status, "DRAFT")) {
    throw new Error(`Cannot move report from ${report.status} to DRAFT.`);
  }

  const updated = await updateConclusionReportRow(reportId, { status: "DRAFT" });

  await writeAuditLog({
    action: "CONCLUSION_REPORT_REOPENED",
    actorUserId: user.authUser.id,
    metadata: { eventId: report.eventId, previousStatus: report.status },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  return updated;
}

export async function reviewConclusionReportRecord(
  user: SessionUser,
  reportId: string,
  input: ApproveConclusionReportInput,
) {
  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  const report = await getConclusionReport(reportId);

  if (!report) {
    throw new Error("Conclusion report was not found.");
  }

  if (!canApproveReport(report)) {
    throw new Error("Only submitted reports can be reviewed.");
  }

  if (report.submittedBy === user.authUser.id) {
    throw new Error("Submitters cannot review their own report.");
  }

  if (!hasRequiredContent(report.content)) {
    throw new Error("Report content is incomplete and cannot be reviewed.");
  }

  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const reviewedAt = new Date().toISOString();
  const updated = await updateConclusionReportRow(reportId, {
    status: input.status,
  });
  await syncEventConclusionReviewed({
    actorUserId: user.authUser.id,
    eventId: report.eventId,
    status: input.status,
  });

  const existingApproval = await getReportApproval(reportId);

  let approvalRow: AppRow;

  if (existingApproval) {
    approvalRow = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.reportApprovals,
      existingApproval.$id,
      {
        reviewNote: input.reviewNote ?? "",
        reviewedAt,
        reviewedBy: user.authUser.id,
        reviewedByName: user.authUser.name || user.authUser.email,
        status: input.status,
      },
    );
  } else {
    approvalRow = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.reportApprovals,
      ID.unique(),
      {
        reportId,
        reviewNote: input.reviewNote ?? "",
        reviewedAt,
        reviewedBy: user.authUser.id,
        reviewedByName: user.authUser.name || user.authUser.email,
        status: input.status,
      },
    );
  }

  await writeAuditLog({
    action: "CONCLUSION_REPORT_REVIEWED",
    actorUserId: user.authUser.id,
    metadata: {
      eventId: report.eventId,
      reviewStatus: input.status,
    },
    targetId: reportId,
    targetType: "conclusion_report",
  });

  if (input.status === "APPROVED") {
    await finalizeEventRolePoints(report.eventId);
  }

  const eventNotificationContext = await getEventNotificationContext(report.eventId, {
    excludeUserIds: [user.authUser.id],
  });

  await notifyReportApprovalWorkflow({
    actorUserId: user.authUser.id,
    eventId: report.eventId,
    eventTitle: report.eventTitle,
    linkHref: `/reports/conclusions?eventId=${report.eventId}`,
    recipientUserIds: [
      report.submittedBy,
      ...eventNotificationContext.recipientUserIds,
    ],
    status: input.status === "APPROVED" ? "approved" : "needs_changes",
  });

  return {
    approval: toReportApproval(approvalRow),
    report: updated,
  };
}
