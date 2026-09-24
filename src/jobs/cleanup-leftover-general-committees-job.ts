import "server-only";

import { z } from "zod";
import type { EventRoleAssignment } from "@/features/access-control/types";
import { isLeftoverGeneralCommittee } from "@/features/events/lib/leftover-general-committee";
import { deleteCommittee, listCommitteesForEvent } from "@/features/events/server/committees.server";
import { getRoleAssignmentsForEvent } from "@/features/events/server/event-roles.server";
import { listEvents } from "@/features/events/server/event-service";
import type { Committee, Event } from "@/features/events/types";

export type CleanupLeftoverGeneralCommitteesJobInput = {
  actorUserId?: string;
  dryRun?: boolean;
};

export type CleanupLeftoverGeneralCommitteesJobResult = {
  deleted: number;
  dryRun: boolean;
  processed: number;
  results: Array<{
    action: "deleted" | "planned" | "skipped";
    committeeId: string;
    eventId: string;
    eventTitle: string;
    reason?: string;
  }>;
  skipped: number;
};

type CleanupJobDeps = {
  deleteCommittee?: typeof deleteCommittee;
  listCommitteesForEvent?: (eventId: string) => Promise<Committee[]>;
  listEvents?: () => Promise<Event[]>;
  listRoleAssignments?: (eventId: string) => Promise<EventRoleAssignment[]>;
};

const cleanupJobInputSchema = z
  .object({
    actorUserId: z.string().trim().min(1).max(64).default("scheduler"),
    dryRun: z.boolean().default(true),
  })
  .strict();

export async function cleanupLeftoverGeneralCommitteesJob(
  input: CleanupLeftoverGeneralCommitteesJobInput = {},
  deps: CleanupJobDeps = {},
): Promise<CleanupLeftoverGeneralCommitteesJobResult> {
  const { actorUserId, dryRun } = cleanupJobInputSchema.parse(input);
  const listAllEvents = deps.listEvents ?? listEvents;
  const listCommittees = deps.listCommitteesForEvent ?? listCommitteesForEvent;
  const listAssignments = deps.listRoleAssignments ?? getRoleAssignmentsForEvent;
  const removeCommittee = deps.deleteCommittee ?? deleteCommittee;

  const results: CleanupLeftoverGeneralCommitteesJobResult["results"] = [];

  for (const event of await listAllEvents()) {
    const leftoverCommittees = (await listCommittees(event.$id)).filter((committee) =>
      isLeftoverGeneralCommittee(committee.name),
    );

    if (leftoverCommittees.length === 0) {
      continue;
    }

    const assignments = await listAssignments(event.$id);
    const hasGeneralRole = assignments.some(
      (assignment) => assignment.committeeName === "General",
    );

    for (const committee of leftoverCommittees) {
      if (hasGeneralRole) {
        results.push({
          action: "skipped",
          committeeId: committee.$id,
          eventId: event.$id,
          eventTitle: event.title,
          reason: "Active role assignment still uses committeeName General.",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          action: "planned",
          committeeId: committee.$id,
          eventId: event.$id,
          eventTitle: event.title,
          reason: "Dry run only. Pass dryRun: false from a trusted runner to delete leftover General committees.",
        });
        continue;
      }

      await removeCommittee(committee.$id, actorUserId);
      results.push({
        action: "deleted",
        committeeId: committee.$id,
        eventId: event.$id,
        eventTitle: event.title,
      });
    }
  }

  return {
    deleted: results.filter((result) => result.action === "deleted").length,
    dryRun,
    processed: results.length,
    results,
    skipped: results.filter((result) => result.action === "skipped").length,
  };
}
