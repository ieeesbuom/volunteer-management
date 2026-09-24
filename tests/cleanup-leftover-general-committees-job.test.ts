import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanupLeftoverGeneralCommitteesJob } from "../src/jobs/cleanup-leftover-general-committees-job";

describe("cleanup leftover General committees job", () => {
  it("skips leftover General when a role assignment still uses that committee name", async () => {
    const deleteCommittee = vi.fn();

    const result = await cleanupLeftoverGeneralCommitteesJob(
      { dryRun: true },
      {
        deleteCommittee,
        listCommitteesForEvent: async () => [
          { $id: "committee-general", name: "General" } as never,
        ],
        listEvents: async () => [{ $id: "event-1", title: "MoraForesight" } as never],
        listRoleAssignments: async () => [
          { committeeName: "General", role: "Committee Lead" } as never,
        ],
      },
    );

    expect(result.dryRun).toBe(true);
    expect(result.skipped).toBe(1);
    expect(result.results[0]).toMatchObject({
      action: "skipped",
      eventId: "event-1",
    });
    expect(deleteCommittee).not.toHaveBeenCalled();
  });

  it("plans leftover General deletes during dry run when no General roles remain", async () => {
    const deleteCommittee = vi.fn();

    const result = await cleanupLeftoverGeneralCommitteesJob(
      { dryRun: true },
      {
        deleteCommittee,
        listCommitteesForEvent: async () => [
          { $id: "committee-general", name: "General" } as never,
        ],
        listEvents: async () => [{ $id: "event-1", title: "MoraForesight" } as never],
        listRoleAssignments: async () => [],
      },
    );

    expect(result.results[0]).toMatchObject({
      action: "planned",
      committeeId: "committee-general",
    });
    expect(deleteCommittee).not.toHaveBeenCalled();
  });
});
