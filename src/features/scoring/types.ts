export type GradingStatus = "pending" | "submitted" | "reviewed" | "finalized";

export interface GradeRequest {
  $id: string;
  requestId: string;
  eventId: string;
  eventTitle?: string;
  requestedBy: string;
  requestedByName?: string;
  targetUserId: string;
  targetUserName?: string;
  status: GradingStatus;
  pointsRequested?: number;
  gradeValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GradeReview {
  $id: string;
  gradeRequestId: string;
  reviewerId: string;
  gradeValue: number;
  submittedAt: string;
  audit_metadata?: string;
}

export interface GradeAuditEntry {
  originalValue: number;
  newValue: number;
  changedBy: string;
  changedAt: string;
  reason?: string;
}


export type PointLedgerSource = "grade" | "role" | "manual";

export interface PointLedgerEntry {
  $id: string;
  userId: string;
  eventId: string;
  eventTitle?: string;
  points: number;
  conclusionApprovalDate: string;
  term: string;
  source: PointLedgerSource;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface TermScoringConfig {
  $id: string;
  userId: string;
  term: string;
  year: number;
  excludedFromTopBoard: boolean;
  reason?: string;
  setBy: string;
}
