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

export type ParticipationStatus = "attended" | "absent" | "excused";

export interface ParticipationRecord {
  $id: string;
  userId: string;
  eventId: string;
  role: string;
  status: ParticipationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipationRosterEntry {
  userId: string;
  name: string;
  googleEmail: string;
  uomEmail?: string;
  eventId: string;
  eventTitle: string;
  role: string;
  committeeName?: string;
  assignedAt: string;
  participation?: ParticipationRecord;
}

export interface ParticipationRoster {
  canManage: boolean;
  eventId: string;
  eventTitle: string;
  records: ParticipationRosterEntry[];
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
