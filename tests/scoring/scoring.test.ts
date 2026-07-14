import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only before any other imports
vi.mock("server-only", () => ({}));

import {
  calculateAverageGrade,
  isEligibleForTopBoard,
  filterLedgerByMonth,
  filterLedgerByTerm,
  sumPointsFromLedger,
  isSelfEventGrade,
} from "../../src/features/scoring/lib/helpers";
import {
  createGradeRequest,
  finalizeGrade,
  finalizeEventRolePoints,
  adminOverrideGrade,
  submitGradeReview,
  listVolunteers,
  listDetailedReviews,
  deleteGradeRequest,
  getLeaderboard,
} from "../../src/features/scoring/server/actions";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { requireAuth, requireAdmin } from "@/features/access-control/server/current-user";
import { listProfiles, getProfile } from "@/features/access-control/server/profiles";
import { assignEventRole } from "@/features/access-control/server/roles";
import type { Profile, AuditAction } from "@/features/access-control/types";
import { hasEventRole } from "@/features/access-control/lib/rules";
import { writeAuditLog } from "@/server/audit";
import type { TablesDB } from "node-appwrite";

vi.mock("@/features/access-control/server/profiles", () => ({
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
}));

// Mocks
vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: vi.fn(),
}));

vi.mock("@/features/access-control/server/current-user", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/features/access-control/lib/rules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/access-control/lib/rules")>();
  return {
    ...actual,
    hasEventRole: vi.fn(),
    canVolunteer: () => true,
  };
});

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "database-1",
  }),
}));

describe("Scoring Pure Helper Functions", () => {
  it("calculateAverageGrade averages multiple reviewers and handles empty arrays", () => {
    expect(calculateAverageGrade([])).toBe(0);
    expect(calculateAverageGrade([8, 9])).toBe(9); // rounds up
    expect(calculateAverageGrade([6, 7])).toBe(7); // rounds to nearest
    expect(calculateAverageGrade([7, 7, 8])).toBe(7); // rounds to nearest
  });

  it("isEligibleForTopBoard respects exclusion config", () => {
    const config = [
      {
        $id: "1",
        userId: "user-1",
        term: "26/27",
        year: 2026,
        excludedFromTopBoard: true,
        setBy: "admin",
      },
    ];

    expect(isEligibleForTopBoard("user-1", "26/27", 2026, config)).toBe(false);
    expect(isEligibleForTopBoard("user-2", "26/27", 2026, config)).toBe(true);
    expect(isEligibleForTopBoard("user-1", "27/28", 2027, config)).toBe(true);
  });

  it("filterLedgerByMonth returns correct entries for Volunteer of the Month", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 5,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "26/27",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 10,
        conclusionApprovalDate: "2026-07-01T12:00:00.000Z",
        term: "26/27",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ];

    const juneEntries = filterLedgerByMonth(ledger, 6, 2026);
    expect(juneEntries.length).toBe(1);
    expect(juneEntries[0].$id).toBe("1");

    const julyEntries = filterLedgerByMonth(ledger, 7, 2026);
    expect(julyEntries.length).toBe(1);
    expect(julyEntries[0].$id).toBe("2");
  });

  it("filterLedgerByTerm returns correct yearly entries", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 5,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "26/27",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 1,
        conclusionApprovalDate: "2027-01-15T12:00:00.000Z",
        term: "26/27",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2027-01-15T12:00:00.000Z",
      },
    ];

    const entries2026 = filterLedgerByTerm(ledger, "26/27");
    expect(entries2026.length).toBe(2);
  });

  it("sumPointsFromLedger reproduces totals correctly", () => {
    const ledger = [
      {
        $id: "1",
        userId: "user-1",
        eventId: "event-1",
        points: 4,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "26/27",
        source: "grade" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
      {
        $id: "2",
        userId: "user-1",
        eventId: "event-2",
        points: 2,
        conclusionApprovalDate: "2026-06-01T12:00:00.000Z",
        term: "26/27",
        source: "role" as const,
        createdBy: "admin",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ];

    expect(sumPointsFromLedger(ledger)).toBe(6);
  });

  it("isSelfEventGrade flags grading when user is a Chair of the event", () => {
    expect(isSelfEventGrade("user-1", "event-1", ["event-1", "event-2"])).toBe(true);
    expect(isSelfEventGrade("user-1", "event-3", ["event-1", "event-2"])).toBe(false);
  });
});

describe("Scoring Server Actions & Access Control", () => {
  type MockTables = {
    listRows: ReturnType<typeof vi.fn>;
    getRow: ReturnType<typeof vi.fn>;
    createRow: ReturnType<typeof vi.fn>;
    updateRow: ReturnType<typeof vi.fn>;
    deleteRow: ReturnType<typeof vi.fn>;
  };
  let mockTables: MockTables;

  const setMockGetRow = (objOrFn: any) => {
    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "events") {
        return Promise.resolve({ $id: id, status: "CLOSED" });
      }
      return Promise.resolve(typeof objOrFn === "function" ? objOrFn(db, table, id) : objOrFn);
    });
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockTables = {
      listRows: vi.fn().mockImplementation((db: string, table: string) => {
        if (table === "event_role_assignments") {
          return Promise.resolve({
            total: 1,
            rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
          });
        }
        if (table === "participation_records") {
          return Promise.resolve({
            total: 1,
            rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
          });
        }
        return Promise.resolve({ total: 0, rows: [] });
      }),
      getRow: vi.fn().mockImplementation((db: string, table: string, id: string) => {
        if (table === "events") {
          return Promise.resolve({ $id: id, status: "CLOSED" });
        }
        return Promise.reject(new Error("Not found"));
      }),
      createRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      updateRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      deleteRow: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(getAppwriteAdminServices).mockReturnValue({
      tables: mockTables as unknown as TablesDB,
    } as unknown as ReturnType<typeof getAppwriteAdminServices>);
  });

  it("allows Chair own-event scoring for Committee Leads and still blocks self-grading", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    vi.mocked(hasEventRole).mockReturnValue(true);
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "lead-1", eventId: "event-1", role: "Committee Lead", active: true }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "lead-1", eventId: "event-1", role: "Committee Lead", status: "attended" }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    const result = await createGradeRequest({
      eventId: "event-1",
      targetUserId: "lead-1",
      gradeValue: 8,
    });

    expect(result.status).toBe("submitted");

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "chair-1", gradeValue: 8 })
    ).rejects.toThrow("You cannot grade yourself.");
  });

  it("Admin can grade any participant without event restrictions", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });

    const result = await createGradeRequest({
      eventId: "event-1",
      targetUserId: "volunteer-1",
      gradeValue: 8,
    });

    expect(result).toBeDefined();
    expect(mockTables.createRow).toHaveBeenCalled();
  });

  it("Point ledger uses conclusionApprovalDate from audit logs, delta is computed", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "admin-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });

    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 2,
          rows: [
            { gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 },
            { gradeRequestId: "request-1", reviewerId: "reviewer-2", gradeValue: 9 },
          ],
        });
      }
      if (table === "conclusion_reports") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "report-1", eventId: "event-1", status: "APPROVED" }],
        });
      }
      if (table === "report_approvals") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "approval-1", reportId: "report-1", status: "APPROVED", reviewedAt: "2026-06-15T10:00:00.000Z" }],
        });
      }
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }

      return Promise.resolve({ total: 0, rows: [] });
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    const result = await finalizeGrade("request-1");

    expect(result.status).toBe("finalized");
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        conclusionApprovalDate: expect.any(String),
        createdAt: "2026-06-15T10:00:00.000Z",
        points: 9, // average of 8 and 9 (rounded)
        source: "grade",
      })
    );
  });

  it("Admin override writes audit record with original + new value", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });

    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "events") {
        return Promise.resolve({ $id: id, status: "CLOSED" });
      }
      if (table === "grade_reviews") {
        return Promise.resolve({
          $id: id,
          gradeRequestId: "request-1",
          reviewerId: "reviewer-1",
          gradeValue: 7,
          audit_metadata: null,
        });
      }
      if (table === "grade_requests") {
        return Promise.resolve({
          $id: "request-1",
          eventId: "event-1",
          targetUserId: "volunteer-1",
          status: "finalized",
        });
      }
    });
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 1,
          rows: [{ gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 }],
        });
      }
      if (table === "point_ledger") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "ledger-1", userId: "volunteer-1", eventId: "event-1", points: 7, source: "grade", conclusionApprovalDate: "2026-06-15T10:00:00.000Z", term: "26/27" }],
        });
      }

      return Promise.resolve({ total: 0, rows: [] });
    });

    const result = await adminOverrideGrade("review-1", 8, "Incorrect scoring input");

    expect(result.gradeValue).toBe(8);
    expect(mockTables.updateRow).toHaveBeenCalledWith(
      "database-1",
      "grade_reviews",
      "review-1",
      expect.objectContaining({
        gradeValue: 8,
        audit_metadata: expect.stringContaining('"originalValue":7,"newValue":8'),
      })
    );

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "GRADE_OVERRIDDEN" as unknown as AuditAction,
        actorUserId: "admin-1",
        metadata: {
          gradeReviewId: "review-1",
          originalValue: 7,
          newValue: 8,
          reason: "Incorrect scoring input",
        },
      })
    );
  });

  it("Blocks Committee Members from submitting reviews", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "member-1", name: "Member User", email: "mem@uom.lk" },
      profile: { $id: "mem-1", authUserId: "member-1", googleEmail: "mem@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r3",
          userId: "member-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Member",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "pending",
    });

    vi.mocked(hasEventRole).mockReturnValue(false);

    await expect(submitGradeReview("request-1", 7)).rejects.toThrow(
      "Only the event chair or an admin can submit extra scores."
    );
  });



  it("Blocks normal edits/reviews if request status is finalized", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "finalized",
    });

    // Submitting review on finalized request
    await expect(submitGradeReview("request-1", 7)).rejects.toThrow(
      "Cannot submit review for a finalized grade request."
    );
  });

  it("Recalculate preserves existing entries and appends delta correctly", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "admin-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });

    // Mock existing point ledger records
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "point_ledger") {
        return Promise.resolve({
          total: 2,
          rows: [
            // Already has 5 points from grade
            { $id: "l1", userId: "volunteer-1", eventId: "event-1", points: 5, source: "grade", conclusionApprovalDate: "2026-06-15T00:00:00.000Z", term: "26/27" },
            // Already has 10 points from role
            { $id: "l2", userId: "volunteer-1", eventId: "event-1", points: 10, source: "role", conclusionApprovalDate: "2026-06-15T00:00:00.000Z", term: "26/27" },
          ],
        });
      }
      if (table === "conclusion_reports") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "report-1", eventId: "event-1", status: "APPROVED" }],
        });
      }
      if (table === "report_approvals") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "approval-1", reportId: "report-1", status: "APPROVED", reviewedAt: "2026-06-15T00:00:00.000Z" }],
        });
      }
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 1,
          rows: [{ gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 }], // new average grade target is 8
        });
      }
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }], // role points = 10
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }

      return Promise.resolve({ total: 0, rows: [] });
    });

    vi.mocked(hasEventRole).mockReturnValue(true);

    const result = await finalizeGrade("request-1");

    expect(result.status).toBe("finalized");
    // Should NOT call deleteRow
    expect(mockTables.deleteRow).not.toHaveBeenCalled();
    // Should append the delta for grade (+3 points, from 5 to 8)
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: 3, // delta
        source: "grade",
      })
    );
    // Should NOT append delta for role (since it is already 10)
    expect(mockTables.createRow).not.toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: expect.any(Number),
        source: "role",
      })
    );
  });

  it("Grader cannot grade themselves", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "volunteer-1", name: "Volunteer One", email: "vol1@uom.lk" },
      profile: { $id: "volunteer-1", authUserId: "volunteer-1", googleEmail: "vol1@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "volunteer-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Lead",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 8 })
    ).rejects.toThrow("You cannot grade yourself.");
  });

  it("Grader cannot review themselves", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "volunteer-1", name: "Volunteer One", email: "vol1@uom.lk" },
      profile: { $id: "volunteer-1", authUserId: "volunteer-1", googleEmail: "vol1@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "volunteer-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Lead",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "pending",
    });

    await expect(submitGradeReview("request-1", 7)).rejects.toThrow(
      "You cannot review your own grade request."
    );
  });

  it("Cannot assign multiple active roles to same person in same event", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      $id: "volunteer-1",
      authUserId: "volunteer-1",
      googleEmail: "vol1@uom.lk",
      uomVerified: true,
      status: "ACTIVE",
      name: "Volunteer One",
    } as unknown as Profile);

    // Mock existing active role
    mockTables.listRows.mockResolvedValue({
      total: 1,
      rows: [
        {
          $id: "er-1",
          userId: "volunteer-1",
          eventId: "event-1",
          role: "Committee Lead",
          active: true,
        },
      ],
    });

    await expect(
      assignEventRole({
        actorUserId: "admin-1",
        eventId: "event-1",
        eventTitle: "Event One",
        role: "Chair",
        userId: "volunteer-1",
      })
    ).rejects.toThrow("Volunteer already has an active role 'Committee Lead' in event 'Event One'.");
  });
});

describe("Scoring New Gated Actions & Helper Actions", () => {
  type MockTables = {
    listRows: ReturnType<typeof vi.fn>;
    getRow: ReturnType<typeof vi.fn>;
    createRow: ReturnType<typeof vi.fn>;
    updateRow: ReturnType<typeof vi.fn>;
    deleteRow: ReturnType<typeof vi.fn>;
  };
  let mockTables: MockTables;

  beforeEach(() => {
    vi.resetAllMocks();

    mockTables = {
      listRows: vi.fn(),
      getRow: vi.fn(),
      createRow: vi.fn(),
      updateRow: vi.fn(),
      deleteRow: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(getAppwriteAdminServices).mockReturnValue({
      tables: mockTables as unknown as TablesDB,
    } as unknown as ReturnType<typeof getAppwriteAdminServices>);
  });

  it("listVolunteers fetches and maps profiles to volunteer options", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "user-1", name: "User 1", email: "user1@uom.lk" },
      profile: { $id: "user-1", authUserId: "user-1", googleEmail: "user1@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [],
    });

    vi.mocked(listProfiles).mockResolvedValue([
      { $id: "vol-1", authUserId: "vol-1", googleEmail: "vol1@uom.lk", name: "John Doe", uomVerified: true, status: "ACTIVE" },
      { $id: "vol-2", authUserId: "vol-2", googleEmail: "vol2@uom.lk", name: "Jane Smith", uomVerified: true, status: "ACTIVE" },
    ] as Profile[]);

    const result = await listVolunteers();
    expect(result).toEqual([
      { email: "vol1@uom.lk", id: "vol-1", name: "John Doe" },
      { email: "vol2@uom.lk", id: "vol-2", name: "Jane Smith" },
    ]);
  });

  it("listDetailedReviews returns combined reviews data for Admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [],
    });

    mockTables.listRows.mockImplementation((db, table) => {
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 1,
          rows: [
            { $id: "rev-1", gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 9, submittedAt: "2026-06-01" },
          ],
        });
      }
      if (table === "grade_requests") {
        return Promise.resolve({
          total: 1,
          rows: [
            { requestId: "request-1", eventId: "event-1", targetUserId: "vol-1" },
          ],
        });
      }
      if (table === "profiles") {
        return Promise.resolve({
          total: 2,
          rows: [
            { $id: "vol-1", name: "John Doe" },
            { $id: "reviewer-1", name: "Jane Reviewer" },
          ],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    const result = await listDetailedReviews();
    expect(result[0]).toEqual(expect.objectContaining({
      volunteerName: "John Doe",
      reviewerName: "Jane Reviewer",
      eventId: "event-1",
      gradeValue: 9,
    }));
  });

  it("deleteGradeRequest removes grade request and its corresponding reviews", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [],
    });

    mockTables.listRows.mockResolvedValue({
      total: 2,
      rows: [
        { $id: "rev-1", gradeRequestId: "req-1" },
        { $id: "rev-2", gradeRequestId: "req-1" },
      ],
    });

    await deleteGradeRequest("req-1");

    expect(mockTables.deleteRow).toHaveBeenCalledWith("database-1", "grade_reviews", "rev-1");
    expect(mockTables.deleteRow).toHaveBeenCalledWith("database-1", "grade_reviews", "rev-2");
    expect(mockTables.deleteRow).toHaveBeenCalledWith("database-1", "grade_requests", "req-1");
  });
});

describe("Scoring Extra Requirements Tests", () => {
  type MockTables = {
    listRows: ReturnType<typeof vi.fn>;
    getRow: ReturnType<typeof vi.fn>;
    createRow: ReturnType<typeof vi.fn>;
    updateRow: ReturnType<typeof vi.fn>;
    deleteRow: ReturnType<typeof vi.fn>;
  };
  let mockTables: MockTables;

  const setMockGetRow = (objOrFn: any) => {
    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "events") {
        return Promise.resolve({ $id: id, status: "CLOSED" });
      }
      return Promise.resolve(typeof objOrFn === "function" ? objOrFn(db, table, id) : objOrFn);
    });
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockTables = {
      listRows: vi.fn(),
      getRow: vi.fn().mockImplementation((db: string, table: string, id: string) => {
        if (table === "events") {
          return Promise.resolve({ $id: id, status: "CLOSED" });
        }
        return Promise.reject(new Error("Not found"));
      }),
      createRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      updateRow: vi.fn().mockImplementation((db, table, id, data) => Promise.resolve({ $id: id, ...data })),
      deleteRow: vi.fn().mockResolvedValue({}),
    };

    vi.mocked(getAppwriteAdminServices).mockReturnValue({
      tables: mockTables as unknown as TablesDB,
    } as unknown as ReturnType<typeof getAppwriteAdminServices>);
  });

  it("blocks finalization until the event has an approved conclusion report", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin User", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "admin-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });
    vi.mocked(hasEventRole).mockReturnValue(true);
    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }
      if (table === "conclusion_reports") {
        return Promise.resolve({ total: 0, rows: [] });
      }
      if (table === "grade_reviews") {
        return Promise.resolve({
          total: 1,
          rows: [{ gradeRequestId: "request-1", reviewerId: "reviewer-1", gradeValue: 8 }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    await expect(finalizeGrade("request-1")).rejects.toThrow(
      "Cannot finalize points until the event has an approved conclusion report."
    );
    expect(mockTables.createRow).not.toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.any(Object)
    );
  });

  it("blocks Committee Leads from approving extra scores", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "lead-1", name: "Lead User", email: "lead@uom.lk" },
      profile: { $id: "lead-1", authUserId: "lead-1", googleEmail: "lead@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "lead-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Lead",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });
    vi.mocked(hasEventRole).mockReturnValue(false);
    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      if (table === "participation_records") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", status: "attended" }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    await expect(finalizeGrade("request-1")).rejects.toThrow(
      "Only admins can approve extra scores."
    );
  });

  it("automatically finalizes role points for active assigned volunteers after approval", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "conclusion_reports") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "report-1", eventId: "event-1", status: "APPROVED" }],
        });
      }
      if (table === "report_approvals") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "approval-1", reportId: "report-1", status: "APPROVED", reviewedAt: "2026-06-15T00:00:00.000Z" }],
        });
      }
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 2,
          rows: [
            { $id: "part-1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true },
            { $id: "part-2", userId: "lead-1", eventId: "event-1", role: "Committee Lead", active: true },
          ],
        });
      }
      if (table === "point_ledger") {
        return Promise.resolve({ total: 0, rows: [] });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    const result = await finalizeEventRolePoints("event-1");

    expect(result).toEqual({ eventId: "event-1", finalized: 2, skipped: 0, unchanged: 0 });
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: 10,
        source: "role",
        userId: "volunteer-1",
      })
    );
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "point_ledger",
      expect.any(String),
      expect.objectContaining({
        points: 25,
        source: "role",
        userId: "lead-1",
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVENT_ROLE_POINTS_FINALIZED" as unknown as AuditAction,
        actorUserId: "admin-1",
      })
    );
  });

  it("requires active event role assignment before creating or finalizing a grade", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "reviewer-1", name: "Reviewer User", email: "rev@uom.lk" },
      profile: { $id: "rev-1", authUserId: "reviewer-1", googleEmail: "rev@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r2",
          userId: "reviewer-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Committee Lead",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });
    vi.mocked(hasEventRole).mockReturnValue(true);
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 0,
          rows: [],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 8 })
    ).rejects.toThrow("Target volunteer does not have an active responsibility assigned for this event.");

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });

    await expect(finalizeGrade("request-1")).rejects.toThrow("Target volunteer does not have an active responsibility assigned for this event.");
  });

  it("enforces grade values as integers from 0 through 10", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "reviewer-1", name: "Reviewer User", email: "rev@uom.lk" },
      profile: { $id: "rev-1", authUserId: "reviewer-1", googleEmail: "rev@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [],
    });
    vi.mocked(requireAdmin).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 11 })
    ).rejects.toThrow();
    await expect(submitGradeReview("request-1", -1)).rejects.toThrow();
    await expect(adminOverrideGrade("review-1", 11, "Out of range")).rejects.toThrow();
  });

  it("applies system Top Board exclusions to monthly and yearly leaderboards", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "point_ledger") {
        return Promise.resolve({
          total: 4,
          rows: [
            { $id: "l1", userId: "volunteer-1", eventId: "event-1", points: 15, conclusionApprovalDate: "2026-10-15T00:00:00.000Z", term: "26/27", source: "role", createdBy: "admin", createdAt: "2026-10-15T00:00:00.000Z" },
            { $id: "l2", userId: "volunteer-2", eventId: "event-2", points: 12, conclusionApprovalDate: "2026-10-20T00:00:00.000Z", term: "26/27", source: "role", createdBy: "admin", createdAt: "2026-10-20T00:00:00.000Z" },
            { $id: "l3", userId: "volunteer-1", eventId: "event-3", points: 8, conclusionApprovalDate: "2026-11-01T00:00:00.000Z", term: "26/27", source: "grade", createdBy: "admin", createdAt: "2026-11-01T00:00:00.000Z" },
            { $id: "l4", userId: "volunteer-2", eventId: "event-4", points: 5, conclusionApprovalDate: "2026-11-02T00:00:00.000Z", term: "26/27", source: "grade", createdBy: "admin", createdAt: "2026-11-02T00:00:00.000Z" },
          ],
        });
      }
      if (table === "term_scoring_config") {
        return Promise.resolve({ total: 0, rows: [] });
      }
      if (table === "profiles") {
        return Promise.resolve({
          total: 2,
          rows: [
            { $id: "volunteer-1", name: "Excluded Volunteer" },
            { $id: "volunteer-2", name: "Eligible Volunteer" },
          ],
        });
      }
      if (table === "top_board_exclusions") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "tbe-1", userId: "volunteer-1", termId: "term-2026", active: true, revokedAt: null }],
        });
      }
      if (table === "ieee_terms") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "term-2026", label: "26/27" }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });
 
    await expect(getLeaderboard({ month: 10, year: 2026 })).resolves.toEqual([
      { userId: "volunteer-2", name: "Eligible Volunteer", points: 12 },
    ]);
    await expect(getLeaderboard({ term: "26/27" })).resolves.toEqual([
      { userId: "volunteer-2", name: "Eligible Volunteer", points: 17 },
    ]);
  });



  it("Chair cannot finalize their own grade request", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "chair-1",
      status: "reviewed",
    });

    await expect(finalizeGrade("request-1")).rejects.toThrow(
      "You cannot finalize your own grade request."
    );
  });

  it("enforces extra score given only one time per event for one volunteer", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    vi.mocked(hasEventRole).mockReturnValue(true);
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });
    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "events") {
        return Promise.resolve({ $id: id, status: "CLOSED" });
      }
      if (table === "grade_requests") {
        return Promise.resolve({
          $id: id,
          eventId: "event-1",
          targetUserId: "volunteer-1",
          status: "pending",
        });
      }
      return Promise.reject(new Error("404"));
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 8 })
    ).rejects.toThrow("An extra score evaluation has already been given to this volunteer for this event.");
  });

  it("blocks Chairs from submitting extra score for another Chair (Admin must give that score)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    vi.mocked(hasEventRole).mockReturnValue(true);
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er2", userId: "chair-2", eventId: "event-1", role: "Chair", active: true }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "chair-2", gradeValue: 8 })
    ).rejects.toThrow("Only admins can submit extra scores for chairs.");
  });

  it("blocks Chairs from approving extra score (Chair gives score for vice chair and others but Admin must approve)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "chair-1", name: "Chair User", email: "chair@uom.lk" },
      profile: { $id: "chair-1", authUserId: "chair-1", googleEmail: "chair@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: false,
      sbRoles: [],
      eventRoles: [
        {
          $id: "r1",
          userId: "chair-1",
          eventId: "event-1",
          eventTitle: "Event One",
          role: "Chair",
          assignedBy: "admin",
          assignedAt: "2026-01-01T00:00:00.000Z",
          active: true,
        },
      ],
    });

    vi.mocked(hasEventRole).mockReturnValue(true);
    mockTables.listRows.mockImplementation((db: string, table: string) => {
      if (table === "event_role_assignments") {
        return Promise.resolve({
          total: 1,
          rows: [{ $id: "er1", userId: "volunteer-1", eventId: "event-1", role: "Committee Member", active: true }],
        });
      }
      return Promise.resolve({ total: 0, rows: [] });
    });
    setMockGetRow({
      $id: "request-1",
      eventId: "event-1",
      targetUserId: "volunteer-1",
      status: "reviewed",
    });

    await expect(finalizeGrade("request-1")).rejects.toThrow(
      "Only admins can approve extra scores."
    );
  });

  it("extra points to an event can only be given after the event is in pending conclusion or closed status", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      authUser: { id: "admin-1", name: "Admin", email: "admin@uom.lk" },
      profile: { $id: "admin-1", authUserId: "admin-1", googleEmail: "admin@uom.lk", uomVerified: true, status: "ACTIVE" },
      isAdmin: true,
      sbRoles: ["Chairperson"],
      eventRoles: [],
    });

    mockTables.getRow.mockImplementation((db: string, table: string, id: string) => {
      if (table === "events") {
        return Promise.resolve({ $id: id, status: "ONGOING" });
      }
      if (table === "grade_requests") {
        return Promise.resolve({
          $id: "request-1",
          eventId: "event-1",
          targetUserId: "volunteer-1",
          status: "pending",
        });
      }
      return Promise.reject(new Error("404"));
    });

    await expect(
      createGradeRequest({ eventId: "event-1", targetUserId: "volunteer-1", gradeValue: 8 })
    ).rejects.toThrow("Extra points to an event can only be given when the event is in PENDING_CONCLUSION or CLOSED status.");

    await expect(
      submitGradeReview("request-1", 8)
    ).rejects.toThrow("Extra points to an event can only be given when the event is in PENDING_CONCLUSION or CLOSED status.");

    await expect(
      finalizeGrade("request-1")
    ).rejects.toThrow("Extra points to an event can only be given when the event is in PENDING_CONCLUSION or CLOSED status.");
  });
});
