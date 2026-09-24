import { describe, expect, it } from "vitest";
import {
  assertCanInspectVolunteerEventRole,
  assertCanListEventVolunteers,
} from "@/features/scoring/server/scoring-access";
import type { SessionUser } from "@/features/access-control/types";

function fakeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: { email: "user@uom.lk", id: "user-1", name: "User" },
    eventRoles: [],
    isAdmin: false,
    labels: [],
    profile: {
      $id: "user-1",
      authUserId: "user-1",
      googleEmail: "user@uom.lk",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
    ...overrides,
  };
}

describe("scoring access helpers", () => {
  it("requires event context for non-admin volunteer listing", () => {
    expect(() => assertCanListEventVolunteers(fakeUser(), undefined)).toThrow(
      "Event context is required",
    );
  });

  it("allows admins to list volunteers without an event", () => {
    expect(() => assertCanListEventVolunteers(fakeUser({ isAdmin: true }), undefined)).not.toThrow();
  });

  it("treats previewing admins as non-admins when isAdmin is overridden", () => {
    expect(() =>
      assertCanListEventVolunteers(fakeUser({ isAdmin: true }), undefined, { isAdmin: false }),
    ).toThrow("Event context is required");
    expect(() =>
      assertCanInspectVolunteerEventRole(
        fakeUser({ isAdmin: true }),
        "other-user",
        "event-1",
        { isAdmin: false },
      ),
    ).toThrow("permission to inspect");
  });

  it("allows event chairs to inspect volunteer roles for their event", () => {
    const user = fakeUser({
      eventRoles: [
        {
          $id: "a1",
          active: true,
          assignedAt: "2026-01-01T00:00:00.000Z",
          assignedBy: "admin",
          eventId: "event-1",
          eventTitle: "Event",
          role: "Chair",
          userId: "user-1",
        },
      ],
    });

    expect(() =>
      assertCanInspectVolunteerEventRole(user, "other-user", "event-1"),
    ).not.toThrow();
  });

  it("blocks unrelated users from inspecting volunteer roles", () => {
    expect(() =>
      assertCanInspectVolunteerEventRole(fakeUser(), "other-user", "event-1"),
    ).toThrow("permission to inspect");
  });
});
