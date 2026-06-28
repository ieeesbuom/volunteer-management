import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRole, EventRoleAssignment, SessionUser } from "@/features/access-control/types";
import type { ConclusionReportContent } from "@/features/reports/types";

type StoredRow = Record<string, unknown> & { $id: string };

const appwriteMock = vi.hoisted(() => {
  type QueryShape = {
    attribute?: string;
    method: string;
    values?: unknown[];
  };

  const tableIds = {
    auditLogs: "audit_logs",
    conclusionReports: "conclusion_reports",
    eventRoleAssignments: "event_role_assignments",
    reportApprovals: "report_approvals",
  } as const;

  const rows = new Map<string, StoredRow[]>();
  let sequence = 0;

  function table(tableId: string) {
    const existing = rows.get(tableId);

    if (existing) {
      return existing;
    }

    const created: StoredRow[] = [];
    rows.set(tableId, created);
    return created;
  }

  function clone(row: StoredRow) {
    return { ...row };
  }

  function parseQuery(query: unknown): QueryShape {
    return typeof query === "string" ? (JSON.parse(query) as QueryShape) : (query as QueryShape);
  }

  function reset() {
    sequence = 0;
    rows.clear();
    Object.values(tableIds).forEach((tableId) => rows.set(tableId, []));
  }

  const tables = {
    createRow: vi.fn(
      async (
        _databaseId: string,
        tableId: string,
        rowId: string,
        payload: Record<string, unknown>,
      ) => {
        const id = rowId === "unique()" ? `${tableId}-${++sequence}` : rowId;
        const row = { $id: id, ...payload };
        table(tableId).push(row);

        return clone(row);
      },
    ),
    getRow: vi.fn(async (_databaseId: string, tableId: string, rowId: string) => {
      const row = table(tableId).find((entry) => entry.$id === rowId);

      if (!row) {
        throw new Error("Row not found.");
      }

      return clone(row);
    }),
    listRows: vi.fn(
      async (_databaseId: string, tableId: string, queries: unknown[] = []) => {
        let result = [...table(tableId)];
        let limit: number | undefined;

        for (const rawQuery of queries) {
          const query = parseQuery(rawQuery);

          if (query.method === "equal" && query.attribute && query.values) {
            result = result.filter((row) => query.values?.includes(row[query.attribute!]));
          }

          if (query.method === "orderDesc" && query.attribute) {
            result = result.sort((left, right) =>
              String(right[query.attribute!]).localeCompare(String(left[query.attribute!])),
            );
          }

          if (query.method === "limit") {
            limit = Number(query.values?.[0]);
          }
        }

        return {
          rows: result.slice(0, limit).map(clone),
          total: result.length,
        };
      },
    ),
    updateRow: vi.fn(
      async (
        _databaseId: string,
        tableId: string,
        rowId: string,
        payload: Record<string, unknown>,
      ) => {
        const tableRows = table(tableId);
        const index = tableRows.findIndex((entry) => entry.$id === rowId);

        if (index === -1) {
          throw new Error("Row not found.");
        }

        const updated = { ...tableRows[index], ...payload };
        tableRows[index] = updated;

        return clone(updated);
      },
    ),
  };

  reset();

  return {
    insertRow(tableId: string, row: StoredRow) {
      table(tableId).push(row);
    },
    reset,
    tableIds,
    tables,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    ADMIN_EMAIL: "admin@example.com",
    APPWRITE_API_KEY: "test-key",
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
    NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: "test-project",
    NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID: "test-bucket",
  }),
}));

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: () => ({ tables: appwriteMock.tables }),
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn(),
}));

import {
  assertConclusionReportExportable,
  canManageConclusionReport,
  createConclusionReportRecord,
  reviewConclusionReportRecord,
  updateConclusionReportRecord,
} from "@/features/reports/server/conclusion-service";

const completeContent: ConclusionReportContent = {
  attendanceNotes: "Peak attendance in the morning session.",
  challenges: "Venue setup took longer than planned.",
  objectives: "Run a technical workshop for student members.",
  outcomes: "Hosted two sessions with strong attendance.",
  recommendations: "Confirm venue access one week earlier.",
};

function eventAssignment({
  eventId = "event-1",
  eventTitle = "IEEE Day",
  role = "Chair",
  userId = "chair-1",
}: {
  eventId?: string;
  eventTitle?: string;
  role?: EventRole;
  userId?: string;
} = {}): EventRoleAssignment {
  return {
    $id: `${userId}-${eventId}-${role}`,
    active: true,
    assignedAt: "2026-01-01T00:00:00.000Z",
    assignedBy: "admin-1",
    committeeName: role === "Committee Lead" || role === "Committee Member" ? "Program" : undefined,
    eventChairCount: role === "Chair" ? 1 : 0,
    eventId,
    eventTitle,
    role,
    userId,
  };
}

function createUser({
  eventRoles = [],
  id = "user-1",
  isAdmin = false,
}: {
  eventRoles?: EventRoleAssignment[];
  id?: string;
  isAdmin?: boolean;
} = {}): SessionUser {
  return {
    authUser: {
      email: `${id}@example.com`,
      id,
      name: id,
    },
    eventRoles,
    isAdmin,
    profile: {
      $id: `profile-${id}`,
      authUserId: id,
      googleEmail: `${id}@example.com`,
      status: "ACTIVE",
      uomEmail: `${id}@uom.lk`,
      uomVerified: true,
    },
    sbRoles: [],
  };
}

function seedEvent(eventId = "event-1", eventTitle = "IEEE Day") {
  appwriteMock.insertRow(appwriteMock.tableIds.eventRoleAssignments, {
    ...eventAssignment({ eventId, eventTitle, userId: "seed-chair" }),
    $id: `seed-${eventId}`,
  });
}

describe("conclusion report service", () => {
  beforeEach(() => {
    appwriteMock.reset();
    vi.clearAllMocks();
  });

  it("allows only admins, chairs, and vice chairs for the target event to manage reports", () => {
    const chair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Chair" })],
    });
    const viceChair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Vice Chair" })],
      id: "vice-1",
    });
    const committeeMember = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Committee Member" })],
      id: "member-1",
    });
    const otherEventChair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-2", role: "Chair" })],
      id: "chair-2",
    });

    expect(canManageConclusionReport(createUser({ isAdmin: true }), "event-1")).toBe(true);
    expect(canManageConclusionReport(chair, "event-1")).toBe(true);
    expect(canManageConclusionReport(viceChair, "event-1")).toBe(true);
    expect(canManageConclusionReport(committeeMember, "event-1")).toBe(false);
    expect(canManageConclusionReport(otherEventChair, "event-1")).toBe(false);
  });

  it("creates and edits reports only for users with the matching event lead role", async () => {
    seedEvent();
    const chair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Chair" })],
      id: "chair-1",
    });
    const otherEventChair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-2", role: "Chair" })],
      id: "chair-2",
    });
    const committeeMember = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Committee Member" })],
      id: "member-1",
    });

    await expect(
      createConclusionReportRecord(committeeMember, {
        content: completeContent,
        eventId: "event-1",
      }),
    ).rejects.toThrow("Required event role is missing.");

    const report = await createConclusionReportRecord(chair, {
      content: completeContent,
      eventId: "event-1",
    });

    expect(report.eventId).toBe("event-1");
    expect(report.eventTitle).toBe("IEEE Day");
    expect(report.status).toBe("DRAFT");

    await expect(
      updateConclusionReportRecord(otherEventChair, report.$id, {
        content: { objectives: "Wrong event update" },
      }),
    ).rejects.toThrow("Required event role is missing.");

    await expect(
      updateConclusionReportRecord(chair, report.$id, {
        content: { objectives: "Updated objective" },
      }),
    ).resolves.toMatchObject({
      content: expect.objectContaining({ objectives: "Updated objective" }),
    });
  });

  it("limits review to admins and blocks export until approval exists", async () => {
    seedEvent();
    const chair = createUser({
      eventRoles: [eventAssignment({ eventId: "event-1", role: "Chair" })],
      id: "chair-1",
    });
    const admin = createUser({ id: "admin-1", isAdmin: true });
    const draft = await createConclusionReportRecord(chair, {
      content: completeContent,
      eventId: "event-1",
    });
    const submitted = await updateConclusionReportRecord(chair, draft.$id, {
      status: "SUBMITTED",
    });

    await expect(assertConclusionReportExportable(submitted.$id)).rejects.toThrow(
      "only after approval",
    );
    await expect(
      reviewConclusionReportRecord(chair, submitted.$id, { status: "APPROVED" }),
    ).rejects.toThrow("Admin access required.");

    const reviewed = await reviewConclusionReportRecord(admin, submitted.$id, {
      reviewNote: "Complete and ready for archive.",
      status: "APPROVED",
    });

    expect(reviewed.report.status).toBe("APPROVED");
    await expect(assertConclusionReportExportable(submitted.$id)).resolves.toMatchObject({
      approval: expect.objectContaining({ status: "APPROVED" }),
      report: expect.objectContaining({ status: "APPROVED" }),
    });
  });
});
