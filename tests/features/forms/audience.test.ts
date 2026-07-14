import { describe, expect, it } from "vitest";
import {
  formatAudienceBadge,
  getFormAudienceMetadata,
  isEligibleForGlobalDashboard,
  isFormVisibleToUser,
} from "@/features/forms/lib/audience";
import type { FormConnection } from "@/features/forms/types";

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

describe("getFormAudienceMetadata", () => {
  it("returns defaults when metadata is missing", () => {
    const conn = createMockConnection();
    expect(getFormAudienceMetadata(conn)).toEqual({
      audience: "public",
      closeAt: undefined,
      openAt: undefined,
      targetCommitteeId: undefined,
    });
  });

  it("extracts audience, committee and dates from metadata", () => {
    const conn = createMockConnection({
      metadata: {
        audience: "event_team_only",
        targetCommitteeId: "Logistics",
        openAt: "2026-05-01T10:00:00Z",
        closeAt: "2026-05-10T10:00:00Z",
      },
    });
    expect(getFormAudienceMetadata(conn)).toEqual({
      audience: "event_team_only",
      targetCommitteeId: "Logistics",
      openAt: "2026-05-01T10:00:00Z",
      closeAt: "2026-05-10T10:00:00Z",
    });
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

  it("allows anyone to view public forms", () => {
    const conn = createMockConnection({
      metadata: { audience: "public" },
    });
    expect(isFormVisibleToUser({ connection: conn })).toBe(true);
  });

  it("allows only logged-in users to view volunteers_only forms", () => {
    const conn = createMockConnection({
      metadata: { audience: "volunteers_only" },
    });
    expect(isFormVisibleToUser({ connection: conn, currentUserId: "u1" })).toBe(true);
    expect(isFormVisibleToUser({ connection: conn })).toBe(false);
  });

  it("restricts event_team_only forms to assigned users or committees", () => {
    const conn = createMockConnection({
      metadata: { audience: "event_team_only", targetCommitteeId: "Logistics" },
    });
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", committeeName: "Logistics" }],
      }),
    ).toBe(true);
    expect(
      isFormVisibleToUser({
        connection: conn,
        currentUserId: "u1",
        userRoleAssignments: [{ userId: "u1", committeeName: "Finance" }],
      }),
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
    expect(formatAudienceBadge("volunteers_only")).toEqual({ label: "Logged-in Volunteers", tone: "success" });
    expect(formatAudienceBadge("event_team_only", "Logistics")).toEqual({ label: "Target: Logistics", tone: "primary" });
    expect(formatAudienceBadge("chairs_only")).toEqual({ label: "Chairs & Admins Only", tone: "warning" });
  });
});
