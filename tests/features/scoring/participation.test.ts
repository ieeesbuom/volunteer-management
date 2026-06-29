import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppwriteException, type TablesDB } from "node-appwrite";
import type { SessionUser } from "@/features/access-control/types";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { listProfiles } from "@/features/access-control/server/profiles";
import { getRoleAssignmentsForEvent } from "@/features/events/server/event-roles.server";
import { requireVisibleEvent } from "@/features/events/server/event-route-helpers";
import { writeAuditLog } from "@/server/audit";
import {
  listEventParticipationRoster,
  upsertEventParticipationRecords,
} from "@/features/scoring/server/participation";

vi.mock("server-only", () => ({}));

vi.mock("@/server/appwrite", () => ({
  getAppwriteAdminServices: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: "database-1",
  }),
}));

vi.mock("@/features/access-control/server/profiles", () => ({
  listProfiles: vi.fn(),
}));

vi.mock("@/features/events/server/event-roles.server", () => ({
  getRoleAssignmentsForEvent: vi.fn(),
}));

vi.mock("@/features/events/server/event-route-helpers", () => ({
  requireVisibleEvent: vi.fn(),
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn(),
}));

describe("participation intake service", () => {
  const user = createSessionUser();
  const mockTables = {
    createRow: vi.fn(),
    getRow: vi.fn(),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAppwriteAdminServices).mockReturnValue({
      tables: mockTables as unknown as TablesDB,
    } as unknown as ReturnType<typeof getAppwriteAdminServices>);
    vi.mocked(requireVisibleEvent).mockResolvedValue({
      event: {
        $createdAt: "2026-01-01T00:00:00.000Z",
        $id: "event-1",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        conclusion_status: "not_submitted",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: "chair-1",
        reference: "MF-4",
        start_date: "2026-06-01T00:00:00.000Z",
        status: "ongoing",
        term: "2025/2026",
        title: "MoraForesight 4.0",
        updated_at: "2026-01-01T00:00:00.000Z",
        year: 2026,
      },
      userEventRole: "Chair",
    });
    vi.mocked(getRoleAssignmentsForEvent).mockResolvedValue([
      {
        $id: "assignment-1",
        active: true,
        assignedAt: "2026-05-01T00:00:00.000Z",
        assignedBy: "chair-1",
        committeeName: "Program",
        eventId: "event-1",
        eventTitle: "MoraForesight 4.0",
        role: "Committee Member",
        userId: "volunteer-1",
      },
    ]);
    vi.mocked(listProfiles).mockResolvedValue([
      {
        $id: "volunteer-1",
        authUserId: "volunteer-1",
        googleEmail: "volunteer@gmail.com",
        name: "Volunteer One",
        status: "ACTIVE",
        uomEmail: "volunteer@uom.lk",
        uomVerified: true,
      },
    ]);
    mockTables.listRows.mockResolvedValue({
      rows: [
        {
          $id: "participation-1",
          createdAt: "2026-06-02T00:00:00.000Z",
          eventId: "event-1",
          role: "Committee Member",
          status: "attended",
          updatedAt: "2026-06-02T00:00:00.000Z",
          userId: "volunteer-1",
        },
      ],
      total: 1,
    });
  });

  it("returns a roster with profile display data and current attendance", async () => {
    const roster = await listEventParticipationRoster({
      eventId: "event-1",
      user,
    });

    expect(roster.canManage).toBe(true);
    expect(roster.records).toEqual([
      expect.objectContaining({
        googleEmail: "volunteer@gmail.com",
        name: "Volunteer One",
        participation: expect.objectContaining({ status: "attended" }),
        userId: "volunteer-1",
      }),
    ]);
  });

  it("creates auditable participation records only for assigned volunteers", async () => {
    mockTables.getRow.mockRejectedValue(new AppwriteException("Not found", 404));
    mockTables.createRow.mockImplementation((_databaseId, _tableId, id, payload) =>
      Promise.resolve({ $id: id, ...payload, createdAt: payload.createdAt }),
    );

    const records = await upsertEventParticipationRecords({
      actor: user,
      eventId: "event-1",
      records: [{ status: "attended", userId: "volunteer-1" }],
    });

    expect(records[0]).toEqual(
      expect.objectContaining({
        eventId: "event-1",
        role: "Committee Member",
        status: "attended",
        userId: "volunteer-1",
      }),
    );
    expect(mockTables.createRow).toHaveBeenCalledWith(
      "database-1",
      "participation_records",
      expect.stringMatching(/^pr_/),
      expect.objectContaining({
        eventId: "event-1",
        role: "Committee Member",
        status: "attended",
        userId: "volunteer-1",
      }),
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PARTICIPATION_RECORD_UPSERTED",
        actorUserId: "chair-1",
        targetId: "event-1",
      }),
    );
  });

  it("rejects participation records for volunteers without active event roles", async () => {
    await expect(
      upsertEventParticipationRecords({
        actor: user,
        eventId: "event-1",
        records: [{ status: "attended", userId: "outsider-1" }],
      }),
    ).rejects.toThrow("Only active event role assignees can receive participation records.");
  });

  it("requires an event manager role to update participation", async () => {
    vi.mocked(requireVisibleEvent).mockResolvedValueOnce({
      event: {
        $createdAt: "2026-01-01T00:00:00.000Z",
        $id: "event-1",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        conclusion_status: "not_submitted",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: "chair-1",
        reference: "MF-4",
        start_date: "2026-06-01T00:00:00.000Z",
        status: "ongoing",
        term: "2025/2026",
        title: "MoraForesight 4.0",
        updated_at: "2026-01-01T00:00:00.000Z",
        year: 2026,
      },
      userEventRole: "Committee Member",
    });

    await expect(
      upsertEventParticipationRecords({
        actor: user,
        eventId: "event-1",
        records: [{ status: "attended", userId: "volunteer-1" }],
      }),
    ).rejects.toThrow("Event participation management permission is required.");
  });
});

function createSessionUser(): SessionUser {
  return {
    authUser: { email: "chair@uom.lk", id: "chair-1", name: "Chair" },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "chair-1",
      authUserId: "chair-1",
      googleEmail: "chair@uom.lk",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
  };
}
