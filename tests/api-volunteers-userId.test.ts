import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "./fixtures";
import type { VolunteerProfileSummary } from "../src/features/volunteers/types";
import type { RecommendationWithRespondent } from "../src/features/recommendations/types";

vi.mock("@/features/access-control/server/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/features/volunteers/server/profiles", () => ({
  getVolunteerProfileSummary: vi.fn(),
}));

vi.mock("@/features/recommendations/server/recommendations", () => ({
  listVisibleRecommendationsForVolunteer: vi.fn(),
}));

import { GET } from "../src/app/api/volunteers/[userId]/route";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import { getVolunteerProfileSummary } from "@/features/volunteers/server/profiles";
import { listVisibleRecommendationsForVolunteer } from "@/features/recommendations/server/recommendations";

const getCurrentUserMock = vi.mocked(getCurrentUser);
const getSummaryMock = vi.mocked(getVolunteerProfileSummary);
const listVisibleMock = vi.mocked(listVisibleRecommendationsForVolunteer);

function makeSummary(overrides: Partial<VolunteerProfileSummary> = {}): VolunteerProfileSummary {
  return {
    details: null,
    eventRoles: [],
    isPrivateView: false,
    name: "Target Volunteer",
    sbRoles: [],
    userId: "user-2",
    ...overrides,
  };
}

const recommendation: RecommendationWithRespondent = {
  $id: "rec-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  requestId: "req-1",
  requesterId: "user-1",
  respondent: null,
  respondentId: "user-2",
  status: "VISIBLE",
  text: "Great volunteer.",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function getRequest() {
  return new Request("http://localhost/api/volunteers/user-2");
}

function params(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe("/api/volunteers/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the profile summary is missing", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    getSummaryMock.mockResolvedValue(null);

    const response = await GET(getRequest(), params("user-2"));

    expect(response.status).toBe(404);
    expect(listVisibleMock).not.toHaveBeenCalled();
  });

  it("includes recommendations for a private (owner/admin) view", async () => {
    getCurrentUserMock.mockResolvedValue(makeSessionUser());
    getSummaryMock.mockResolvedValue(makeSummary({ isPrivateView: true }));
    listVisibleMock.mockResolvedValue([recommendation]);

    const response = await GET(getRequest(), params("user-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendations).toHaveLength(1);
    expect(listVisibleMock).toHaveBeenCalledWith("user-2");
  });

  it("omits recommendations for a public view and never queries them", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    getSummaryMock.mockResolvedValue(makeSummary({ isPrivateView: false }));

    const response = await GET(getRequest(), params("user-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendations).toEqual([]);
    expect(listVisibleMock).not.toHaveBeenCalled();
  });
});
