import { describe, expect, it } from "vitest";
import { canViewEventCommittees } from "@/features/events/lib/committee-permissions";
import { isEventVisibleToUser } from "@/features/events/lib/event-permissions";
import {
  canChangeEventStatus,
  canCreateEvent,
  requireEventCreator,
  requireVerifiedVolunteer,
} from "@/features/events/server/event-route-helpers";
import type { Event } from "@/features/events/types";

function createEventFixture(overrides: Partial<Event> = {}): Event {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: "event-1",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    conclusion_status: "approved",
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "creator-user",
    reference: "MF-4",
    start_date: "2026-06-01T00:00:00.000Z",
    status: "closed",
    term: "25/26",
    title: "Closed Event",
    updated_at: "2026-01-01T00:00:00.000Z",
    year: 2026,
    ...overrides,
  };
}

describe("event route helpers and permissions", () => {
  it("allows only admins to create events", () => {
    expect(
      canCreateEvent({
        authUser: { email: "excom@example.com", id: "user-1", name: "ExCom" },
        eventRoles: [],
        isAdmin: false,
        profile: {
          $id: "profile-1",
          authUserId: "user-1",
          googleEmail: "excom@example.com",
          status: "ACTIVE",
          uomVerified: true,
        },
        sbRoles: ["Chairperson"],
      }),
    ).toBe(false);

    expect(
      canCreateEvent({
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
      }),
    ).toBe(true);
  });

  it("hides closed events from users without roles", () => {
    const closedEvent = createEventFixture();

    expect(isEventVisibleToUser("user-1", false, closedEvent)).toBe(false);
    expect(canViewEventCommittees("user-1", false, closedEvent, null)).toBe(false);
  });

  it("returns 401 when requireVerifiedVolunteer is called without a session", async () => {
    const response = requireVerifiedVolunteer(null);

    expect(response?.status).toBe(401);
  });

  it("returns 403 when requireVerifiedVolunteer is called for unverified volunteers", async () => {
    const response = requireVerifiedVolunteer({
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

    expect(response?.status).toBe(403);
  });

  it("returns 403 when requireEventCreator is called without admin access", async () => {
    const response = requireEventCreator({
      authUser: { email: "user@uom.lk", id: "user-1", name: "Volunteer" },
      eventRoles: [],
      isAdmin: false,
      profile: {
        $id: "profile-1",
        authUserId: "user-1",
        googleEmail: "user@uom.lk",
        status: "ACTIVE",
        uomVerified: true,
      },
      sbRoles: [],
    });

    expect(response?.status).toBe(403);
  });

  it("allows admins to bypass requireEventCreator without SB roles", async () => {
    const response = requireEventCreator({
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

    expect(response).toBeNull();
  });

  it("allows admins to bypass conclusion-managed status changes only through helpers", () => {
    const event = createEventFixture({ status: "ongoing" });

    expect(
      canChangeEventStatus({
        event,
        newStatus: "pending_conclusion",
        user: {
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
        },
      }),
    ).toBe(false);
  });
});
