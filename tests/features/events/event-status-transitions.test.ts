import { describe, expect, it } from "vitest";
import {
  assertOperationalStatusTransition,
  getOperationalStatusTransitions,
} from "@/features/events/lib/event-status-transitions";
import { ConclusionManagedStatusError } from "@/features/events/lib/event-status-transitions";

describe("operational status transitions", () => {
  it("blocks pending_conclusion via generic status changes", () => {
    expect(() => assertOperationalStatusTransition("ongoing", "pending_conclusion")).toThrow(
      ConclusionManagedStatusError,
    );
  });

  it("blocks closed via generic status changes", () => {
    expect(() => assertOperationalStatusTransition("pending_conclusion", "closed")).toThrow(
      ConclusionManagedStatusError,
    );
  });

  it("blocks skipped operational lifecycle transitions", () => {
    expect(() => assertOperationalStatusTransition("draft", "published")).toThrow(
      'Illegal event status transition from "draft" to "published".',
    );
    expect(() => assertOperationalStatusTransition("planning", "ongoing")).toThrow(
      'Illegal event status transition from "planning" to "ongoing".',
    );
  });

  it("excludes conclusion-managed statuses from available transitions", () => {
    const transitions = getOperationalStatusTransitions("ongoing", { isAdmin: true });

    expect(transitions).not.toContain("pending_conclusion");
    expect(transitions).not.toContain("closed");
  });

  it("allows admins to revert ongoing back to published", () => {
    const adminTransitions = getOperationalStatusTransitions("ongoing", { isAdmin: true });
    expect(adminTransitions).toContain("published");
  });

  it("does not allow non-admins to revert ongoing to published", () => {
    const nonAdminTransitions = getOperationalStatusTransitions("ongoing", { isAdmin: false });
    expect(nonAdminTransitions).not.toContain("published");
  });
});
