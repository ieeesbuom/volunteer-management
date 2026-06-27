import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRoleAssignment } from "@/features/access-control/types";

const mockTables = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const mockUsers = {
  get: vi.fn(),
};

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({
    tables: mockTables,
    users: mockUsers,
  }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
  }),
}));

vi.mock("@/features/access-control/server/profiles", () => ({
  getProfile: vi.fn(),
}));

vi.mock("@/features/events/server/event-audit", () => ({
  safeEventAuditLog: vi.fn(),
}));

vi.mock("@/features/events/server/committees.server", () => ({
  hasCommitteesForEvent: vi.fn().mockResolvedValue(true),
  listCommitteesForEvent: vi.fn().mockResolvedValue([{ $id: "committee-1", name: "Program" }]),
}));

vi.mock("@/features/events/server/event-service", () => ({
  getEventById: vi.fn().mockResolvedValue({
    $id: "event-1",
    title: "Test Event",
  }),
}));

const assignAccessControlEventRole = vi.fn();
const revokeEventRole = vi.fn();

vi.mock("@/features/access-control/server/roles", () => ({
  assignEventRole: (...args: unknown[]) => assignAccessControlEventRole(...args),
  getActiveEventRoleAssignments: vi.fn().mockResolvedValue([]),
  revokeEventRole: (...args: unknown[]) => revokeEventRole(...args),
  toEventRoleAssignment: (row: Record<string, unknown>) => ({
    $id: String(row.$id),
    active: Boolean(row.active),
    assignedAt: String(row.assignedAt),
    assignedBy: String(row.assignedBy),
    committeeName: row.committeeName ? String(row.committeeName) : undefined,
    eventId: String(row.eventId),
    eventTitle: String(row.eventTitle),
    role: row.role,
    userId: String(row.userId),
  }),
}));

function createAssignment(
  overrides: Partial<EventRoleAssignment> = {},
): EventRoleAssignment {
  return {
    $id: "assignment-old",
    active: true,
    assignedAt: "2026-01-01T00:00:00.000Z",
    assignedBy: "admin-user",
    eventId: "event-1",
    eventTitle: "Test Event",
    role: "Committee Member",
    userId: "user-1",
    ...overrides,
  };
}

describe("event-roles.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignEventRole", () => {
    it("assignEventRole with disabled user throws ValidationError", async () => {
      const { getProfile } = await import("@/features/access-control/server/profiles");
      const { assignEventRole } = await import("@/features/events/server/event-roles.server");
      const { ValidationError } = await import("@/server/errors");

      mockUsers.get.mockResolvedValueOnce({ status: true });
      vi.mocked(getProfile).mockResolvedValueOnce({
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@example.com",
        status: "DISABLED",
        uomVerified: true,
      });

      await expect(
        assignEventRole(
          {
            event_id: "event-1",
            role: "Vice Chair",
            user_id: "user-1",
          },
          "admin-user",
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("assignEventRole with unverified user throws ValidationError", async () => {
      const { getProfile } = await import("@/features/access-control/server/profiles");
      const { assignEventRole } = await import("@/features/events/server/event-roles.server");
      const { ValidationError } = await import("@/server/errors");

      mockUsers.get.mockResolvedValueOnce({ status: true });
      vi.mocked(getProfile).mockResolvedValueOnce({
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@example.com",
        status: "ACTIVE",
        uomVerified: false,
      });

      await expect(
        assignEventRole(
          {
            event_id: "event-1",
            role: "Vice Chair",
            user_id: "user-1",
          },
          "admin-user",
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("replaceEventRole", () => {
    it("rolls back the new assignment when deleting the old one fails", async () => {
      const { replaceEventRole } = await import("@/features/events/server/event-roles.server");
      const { ConflictError } = await import("@/server/errors");
      const newAssignment = createAssignment({
        $id: "assignment-new",
        role: "Vice Chair",
      });

      mockTables.getRow.mockResolvedValueOnce({
        $id: "assignment-old",
        active: true,
        assignedAt: "2026-01-01T00:00:00.000Z",
        assignedBy: "admin-user",
        committeeName: "",
        eventId: "event-1",
        eventTitle: "Test Event",
        role: "Committee Member",
        userId: "user-1",
      });
      assignAccessControlEventRole.mockResolvedValueOnce(newAssignment);
      mockTables.deleteRow.mockRejectedValueOnce(new Error("delete failed"));

      await expect(
        replaceEventRole({
          actorUserId: "admin-user",
          eventId: "event-1",
          eventTitle: "Test Event",
          newRole: "Vice Chair",
          oldAssignmentId: "assignment-old",
          userId: "user-1",
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(revokeEventRole).toHaveBeenCalledWith({
        actorUserId: "admin-user",
        assignmentId: "assignment-new",
      });
    });
  });

  describe("approveConclusion authorization", () => {
    it("approveConclusion: non-admin gets ForbiddenError via route helper permissions", async () => {
      const { getEventPermissions } = await import("@/features/events/lib/event-permissions");

      const permissions = getEventPermissions(
        "chair-user",
        false,
        {
          $createdAt: "2026-01-01T00:00:00.000Z",
          $id: "event-1",
          $updatedAt: "2026-01-01T00:00:00.000Z",
          conclusion_status: "submitted",
          created_at: "2026-01-01T00:00:00.000Z",
          created_by: "admin-user",
          reference: "MF-4",
          start_date: "2026-06-01T00:00:00.000Z",
          status: "pending_conclusion",
          term: "2025/2026",
          title: "Event",
          updated_at: "2026-01-01T00:00:00.000Z",
          year: 2026,
        },
        "Chair",
      );

      expect(permissions.canApproveConclusion).toBe(false);
    });
  });
});

describe("committee permissions", () => {
  it("blocks chairs from assigning the chair role", async () => {
    const { canAssignCommitteeRole } = await import(
      "@/features/events/lib/committee-permissions"
    );

    expect(
      canAssignCommitteeRole({
        actorEventRole: "Chair",
        isAdmin: false,
        targetRole: "Chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorEventRole: "Chair",
        isAdmin: false,
        targetRole: "Vice Chair",
      }),
    ).toBe(true);

    expect(
      canAssignCommitteeRole({
        actorEventRole: null,
        isAdmin: false,
        targetRole: "Chair",
      }),
    ).toBe(false);

    expect(
      canAssignCommitteeRole({
        actorEventRole: null,
        isAdmin: true,
        targetRole: "Chair",
      }),
    ).toBe(true);
  });
});

describe("role display enrichment", () => {
  it("enriches role assignments with eventChairCount for multiple chairs", async () => {
    mockTables.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "assignment-chair-1",
          active: true,
          assignedAt: "2026-01-01T00:00:00.000Z",
          assignedBy: "admin-user",
          eventId: "event-1",
          eventTitle: "Test Event",
          role: "Chair",
          userId: "user-1",
        },
        {
          $id: "assignment-chair-2",
          active: true,
          assignedAt: "2026-01-02T00:00:00.000Z",
          assignedBy: "admin-user",
          eventId: "event-1",
          eventTitle: "Test Event",
          role: "Chair",
          userId: "user-2",
        },
        {
          $id: "assignment-vice",
          active: true,
          assignedAt: "2026-01-03T00:00:00.000Z",
          assignedBy: "admin-user",
          eventId: "event-1",
          eventTitle: "Test Event",
          role: "Vice Chair",
          userId: "user-3",
        },
      ],
    });

    const { getRoleAssignmentsForEvent, formatRoleAssignmentDisplay } = await import(
      "@/features/events/server/event-roles.server"
    );

    const assignments = await getRoleAssignmentsForEvent("event-1");

    expect(assignments).toHaveLength(3);
    expect(assignments.every((assignment) => assignment.eventChairCount === 2)).toBe(
      true,
    );
    expect(formatRoleAssignmentDisplay(assignments[0]!)).toBe("Co-chair");
    expect(formatRoleAssignmentDisplay(assignments[1]!)).toBe("Co-chair");
    expect(formatRoleAssignmentDisplay(assignments[2]!)).toBe("Vice Chair");
  });

  it("keeps a single chair labeled as Chair", async () => {
    mockTables.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "assignment-chair-1",
          active: true,
          assignedAt: "2026-01-01T00:00:00.000Z",
          assignedBy: "admin-user",
          eventId: "event-1",
          eventTitle: "Test Event",
          role: "Chair",
          userId: "user-1",
        },
      ],
    });

    const { getRoleAssignmentsForEvent, formatRoleAssignmentDisplay } = await import(
      "@/features/events/server/event-roles.server"
    );

    const assignments = await getRoleAssignmentsForEvent("event-1");

    expect(assignments[0]?.eventChairCount).toBe(1);
    expect(formatRoleAssignmentDisplay(assignments[0]!)).toBe("Chair");
  });
});

describe("admin verification bypass", () => {
  it("returns 401 when requireVerifiedVolunteer is called without a session", async () => {
    const { requireVerifiedVolunteer } = await import(
      "@/features/events/server/event-route-helpers"
    );

    const result = requireVerifiedVolunteer(null);

    expect(result?.status).toBe(401);
  });

  it("returns 403 when requireVerifiedVolunteer is called for unverified volunteers", async () => {
    const { requireVerifiedVolunteer } = await import(
      "@/features/events/server/event-route-helpers"
    );

    const result = requireVerifiedVolunteer({
      authUser: { email: "user@uom.lk", id: "user-1", name: "Volunteer" },
      eventRoles: [],
      isAdmin: false,
      profile: {
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@uom.lk",
        status: "ACTIVE",
        uomVerified: false,
      },
      sbRoles: [],
    });

    expect(result?.status).toBe(403);
  });

  it("admin without verification passes requireVerifiedVolunteer", async () => {
    const { requireVerifiedVolunteer } = await import(
      "@/features/events/server/event-route-helpers"
    );

    const result = requireVerifiedVolunteer({
      authUser: { email: "admin@example.com", id: "admin-1", name: "Admin" },
      eventRoles: [],
      isAdmin: true,
      profile: {
        $id: "profile-admin",
        authUserId: "admin-1",
        googleEmail: "admin@example.com",
        status: "ACTIVE",
        uomVerified: false,
      },
      sbRoles: [],
    });

    expect(result).toBeNull();
  });
});
