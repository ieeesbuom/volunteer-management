import { describe, expect, it } from "vitest";
import {
  formatAudienceBadge,
  getFormAudienceMetadata,
  isEligibleForGlobalDashboard,
  isFormEligibleForDashboard,
  isFormScheduleOpen,
  isFormVisibleToUser,
  shouldExcludeAssignedEventOpportunity,
} from "@/features/forms/lib/audience";
import type { FormConnection } from "@/features/forms/types";
import type { SessionUser } from "@/features/access-control/types";

function createMockConnection(overrides: Partial<FormConnection> = {}): FormConnection {
  return {
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "admin-id",
    eventId: "event-1",
    id: "conn-1",
    provider: "google_forms",
    purpose: "registration",
    status: "active",
    title: "Registration Form",
    updatedAt: "2026-01-01T00:00:00Z",
    formUrl: "https://forms.gle/test",
    ...overrides,
  };
}

function createUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    authUser: { email: "v@uom.lk", id: "u1", name: "Volunteer" },
    eventRoles: [],
    isAdmin: false,
    profile: {
      $id: "profile-1",
      authUserId: "u1",
      googleEmail: "v@gmail.com",
      status: "ACTIVE",
      uomVerified: true,
    },
    sbRoles: [],
    ...overrides,
  };
}

describe("getFormAudienceMetadata", () => {
  it("returns defaults when metadata is missing", () => {
    const conn = createMockConnection();
    expect(getFormAudienceMetadata(conn)).toEqual({
      audience: "public",
      closeAt: undefined,
      openAt: undefined,
      targetCommitteeId: undefined,
      targetCommitteeName: undefined,
    });
  });

  it("extracts audience, committee and dates from metadata", () => {
    const conn = createMockConnection({
      metadata: {
        audience: "event_team_only",
        targetCommitteeId: "committee-1",
        targetCommitteeName: "Logistics",
        openAt: "2026-05-01T10:00:00Z",
        closeAt: "2026-05-10T10:00:00Z",
      },
    });
    expect(getFormAudienceMetadata(conn)).toEqual({
      audience: "event_team_only",
      targetCommitteeId: "committee-1",
      targetCommitteeName: "Logistics",
      openAt: "2026-05-01T10:00:00Z",
      closeAt: "2026-05-10T10:00:00Z",
    });
  });
});

describe("isFormScheduleOpen", () => {
  it("respects open and close windows", () => {
    const conn = createMockConnection({
      metadata: {
        openAt: "2026-05-01T00:00:00.000Z",
        closeAt: "2026-05-10T00:00:00.000Z",
      },
    });

    expect(isFormScheduleOpen(conn, new Date("2026-04-30T23:00:00.000Z"))).toBe(false);
    expect(isFormScheduleOpen(conn, new Date("2026-05-05T12:00:00.000Z"))).toBe(true);
    expect(isFormScheduleOpen(conn, new Date("2026-05-11T00:00:00.000Z"))).toBe(false);
  });
});

describe("isFormVisibleToUser", () => {
  it("allows canManage (chair/admin) to view any form", () => {
    const conn = createMockConnection({
      metadata: { audience: "chairs_only" },
    });
    expect(isFormVisibleToUser({ canManage: true, connection: conn })).toBe(true);
    expect(isFormVisibleToUser({ canManage: false, connection: conn })).toBe(false);
  });

  it("allows anyone to view public forms that are open", () => {
    const conn = createMockConnection({
      metadata: { audience: "public" },
    });
    expect(isFormVisibleToUser({ connection: conn })).toBe(true);
  });

  it("allows only verified volunteers to view volunteers_only forms", () => {
    const conn = createMockConnection({
      metadata: { audience: "volunteers_only" },
    });
    expect(
      isFormVisibleToUser({ connection: conn, currentUserId: "u1", isVolunteer: true }),
    ).toBe(true);
    expect(
      isFormVisibleToUser({ connection: conn, currentUserId: "u1", isVolunteer: false }),
    ).toBe(false);
    expect(isFormVisibleToUser({ connection: conn, isVolunteer: true })).toBe(false);
  });

  it("restricts event_team_only forms to assigned users or committees", () => {
    const conn = createMockConnection({
      metadata: {
        audience: "event_team_only",
        targetCommitteeId: "committee-1",
        targetCommitteeName: "Logistics",
      },
    });
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", committeeName: "Logistics", eventId: "event-1" }],
      }),
    ).toBe(true);
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", committeeName: "Finance", eventId: "event-1" }],
      }),
    ).toBe(false);
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [],
      }),
    ).toBe(false);
  });

  it("allows chairs_only for chair roles and admins", () => {
    const conn = createMockConnection({
      metadata: { audience: "chairs_only" },
    });
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", role: "Chair", eventId: "event-1" }],
      }),
    ).toBe(true);
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        isAdmin: true,
      }),
    ).toBe(true);
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", role: "Committee Member", eventId: "event-1" }],
      }),
    ).toBe(false);
  });
});

describe("isFormEligibleForDashboard", () => {
  it("shows public registration forms to any signed-in user while open", () => {
    const user = createUser({
      profile: {
        $id: "p1",
        authUserId: "u1",
        googleEmail: "a@gmail.com",
        status: "ACTIVE",
        uomVerified: false,
      },
    });
    expect(
      isFormEligibleForDashboard(createMockConnection({ metadata: { audience: "public" } }), user),
    ).toBe(true);
  });

  it("hides volunteers_only forms from unverified users", () => {
    const user = createUser({
      profile: {
        $id: "p1",
        authUserId: "u1",
        googleEmail: "a@gmail.com",
        status: "ACTIVE",
        uomVerified: false,
      },
    });
    expect(
      isFormEligibleForDashboard(
        createMockConnection({ metadata: { audience: "volunteers_only" } }),
        user,
      ),
    ).toBe(false);
  });

  it("shows event_team_only forms only when the user is assigned", () => {
    const form = createMockConnection({
      metadata: { audience: "event_team_only" },
      purpose: "feedback",
    });
    const outsider = createUser();
    const member = createUser({
      eventRoles: [
        {
          $id: "a1",
          active: true,
          assignedAt: "2026-01-01T00:00:00Z",
          assignedBy: "admin",
          committeeName: "Logistics",
          eventId: "event-1",
          eventTitle: "Tech Week",
          role: "Committee Member",
          userId: "u1",
        },
      ],
    });

    expect(isFormEligibleForDashboard(form, outsider)).toBe(false);
    expect(isFormEligibleForDashboard(form, member)).toBe(true);
  });

  it("shows volunteers_only open calls even when purpose is other", () => {
    const user = createUser();
    expect(
      isFormEligibleForDashboard(
        createMockConnection({
          metadata: { audience: "volunteers_only" },
          purpose: "other",
          title: "Call for Logistics Crew",
        }),
        user,
      ),
    ).toBe(true);
  });

  it("hides feedback forms from the open-opportunity overview", () => {
    const user = createUser();
    expect(
      isFormEligibleForDashboard(
        createMockConnection({
          metadata: { audience: "volunteers_only" },
          purpose: "feedback",
        }),
        user,
      ),
    ).toBe(false);
  });

  it("hides forms outside their availability window", () => {
    const user = createUser();
    const form = createMockConnection({
      metadata: {
        audience: "public",
        openAt: "2099-01-01T00:00:00.000Z",
      },
    });
    expect(isFormEligibleForDashboard(form, user)).toBe(false);
  });
});

describe("shouldExcludeAssignedEventOpportunity", () => {
  it("excludes public opportunities for events the user already joined", () => {
    expect(
      shouldExcludeAssignedEventOpportunity(
        createMockConnection({ metadata: { audience: "public" } }),
        new Set(["event-1"]),
      ),
    ).toBe(true);
  });

  it("keeps volunteers_only and team forms visible even when the user is assigned", () => {
    expect(
      shouldExcludeAssignedEventOpportunity(
        createMockConnection({ metadata: { audience: "volunteers_only" } }),
        new Set(["event-1"]),
      ),
    ).toBe(false);
    expect(
      shouldExcludeAssignedEventOpportunity(
        createMockConnection({ metadata: { audience: "event_team_only" } }),
        new Set(["event-1"]),
      ),
    ).toBe(false);
  });
});

describe("isEligibleForGlobalDashboard", () => {
  it("returns true for active registration public or volunteer forms without committee targeting", () => {
    expect(isEligibleForGlobalDashboard(createMockConnection({ metadata: { audience: "public" } }))).toBe(true);
    expect(isEligibleForGlobalDashboard(createMockConnection({ metadata: { audience: "volunteers_only" } }))).toBe(true);
  });

  it("returns false if audience is event_team_only or chairs_only or committee targeted", () => {
    expect(isEligibleForGlobalDashboard(createMockConnection({ metadata: { audience: "event_team_only" } }))).toBe(false);
    expect(isEligibleForGlobalDashboard(createMockConnection({ metadata: { audience: "chairs_only" } }))).toBe(false);
    expect(isEligibleForGlobalDashboard(createMockConnection({ metadata: { audience: "public", targetCommitteeId: "Logistics" } }))).toBe(false);
  });
});

describe("formatAudienceBadge", () => {
  it("formats badges cleanly for each audience tier", () => {
    expect(formatAudienceBadge("public")).toEqual({ label: "Public", tone: "neutral" });
    expect(formatAudienceBadge("volunteers_only")).toEqual({
      label: "Verified Volunteers",
      tone: "success",
    });
    expect(formatAudienceBadge("event_team_only", "Logistics")).toEqual({
      label: "Target: Logistics",
      tone: "primary",
    });
    expect(formatAudienceBadge("chairs_only")).toEqual({
      label: "Chairs & Admins Only",
      tone: "warning",
    });
  });
});
