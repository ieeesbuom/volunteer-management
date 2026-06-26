import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "./fixtures";
import type {
  Recommendation,
  RecommendationRequest,
  RecommendationWithProfiles,
} from "../src/features/recommendations/types";

vi.mock("@/features/access-control/server/current-user", () => ({
  requireUomVerifiedVolunteer: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/features/recommendations/server/recommendations", () => ({
  listRecommendationRequestsForVolunteer: vi.fn(),
  requestRecommendation: vi.fn(),
  respondToRecommendationRequest: vi.fn(),
  reportRecommendation: vi.fn(),
  hideRecommendation: vi.fn(),
  dismissRecommendationReport: vi.fn(),
  listReportedRecommendations: vi.fn(),
}));

import { POST as requestPost } from "../src/app/api/recommendations/request/route";
import { POST as respondPost } from "../src/app/api/recommendations/respond/route";
import { POST as reportPost } from "../src/app/api/recommendations/report/route";
import { POST as hidePost } from "../src/app/api/recommendations/hide/route";
import { POST as dismissPost } from "../src/app/api/recommendations/dismiss-report/route";
import { GET as reportedGet } from "../src/app/api/admin/recommendations/reported/route";
import {
  requireAdmin,
  requireUomVerifiedVolunteer,
} from "@/features/access-control/server/current-user";
import {
  dismissRecommendationReport,
  hideRecommendation,
  listReportedRecommendations,
  reportRecommendation,
  requestRecommendation,
  respondToRecommendationRequest,
} from "@/features/recommendations/server/recommendations";

const requireVolunteerMock = vi.mocked(requireUomVerifiedVolunteer);
const requireAdminMock = vi.mocked(requireAdmin);
const requestRecommendationMock = vi.mocked(requestRecommendation);
const respondMock = vi.mocked(respondToRecommendationRequest);
const reportMock = vi.mocked(reportRecommendation);
const hideMock = vi.mocked(hideRecommendation);
const dismissMock = vi.mocked(dismissRecommendationReport);
const listReportedMock = vi.mocked(listReportedRecommendations);

function makeRequest(overrides: Partial<RecommendationRequest> = {}): RecommendationRequest {
  return {
    $id: "req-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    requestKey: "user-1:user-2",
    requesterId: "user-1",
    respondentId: "user-2",
    status: "PENDING",
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    $id: "rec-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    requestId: "req-1",
    requesterId: "user-1",
    respondentId: "user-2",
    status: "VISIBLE",
    text: "Great volunteer.",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function postJson(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/recommendations/request", () => {
  it("creates a request for a verified volunteer", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    requestRecommendationMock.mockResolvedValue(makeRequest());

    const response = await requestPost(
      postJson("http://localhost/api/recommendations/request", {
        message: "Please recommend me.",
        respondentId: "user-2",
      }),
    );

    expect(response.status).toBe(200);
    expect(requestRecommendationMock.mock.calls[0]?.[0]).toMatchObject({
      message: "Please recommend me.",
      respondentId: "user-2",
    });
  });

  it("returns 400 when respondentId is missing", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());

    const response = await requestPost(
      postJson("http://localhost/api/recommendations/request", { message: "Hi" }),
    );

    expect(response.status).toBe(400);
    expect(requestRecommendationMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester is not UoM verified", async () => {
    requireVolunteerMock.mockRejectedValue(
      new Error("Verified UoM email is required before volunteering."),
    );

    const response = await requestPost(
      postJson("http://localhost/api/recommendations/request", { respondentId: "user-2" }),
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 for a duplicate pending request", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    requestRecommendationMock.mockRejectedValue(
      new Error("A pending recommendation request already exists for this volunteer."),
    );

    const response = await requestPost(
      postJson("http://localhost/api/recommendations/request", { respondentId: "user-2" }),
    );

    expect(response.status).toBe(409);
  });

  it("returns 400 when attempting to recommend yourself", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    requestRecommendationMock.mockRejectedValue(
      new Error("A user cannot recommend themselves."),
    );

    const response = await requestPost(
      postJson("http://localhost/api/recommendations/request", { respondentId: "user-1" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("POST /api/recommendations/respond", () => {
  it("accepts a request with recommendation text", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    respondMock.mockResolvedValue({
      recommendation: makeRecommendation(),
      request: makeRequest({ status: "ACCEPTED" }),
    });

    const response = await respondPost(
      postJson("http://localhost/api/recommendations/respond", {
        requestId: "req-1",
        response: "ACCEPTED",
        text: "Excellent work.",
      }),
    );

    expect(response.status).toBe(200);
    expect(respondMock.mock.calls[0]?.[0]).toMatchObject({
      requestId: "req-1",
      response: "ACCEPTED",
      text: "Excellent work.",
    });
  });

  it("rejects a request", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    respondMock.mockResolvedValue({
      recommendation: null,
      request: makeRequest({ status: "REJECTED" }),
    });

    const response = await respondPost(
      postJson("http://localhost/api/recommendations/respond", {
        requestId: "req-1",
        response: "REJECTED",
      }),
    );

    expect(response.status).toBe(200);
    expect(respondMock.mock.calls[0]?.[0]).toMatchObject({ response: "REJECTED" });
  });

  it("returns 400 for an invalid response enum", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());

    const response = await respondPost(
      postJson("http://localhost/api/recommendations/respond", {
        requestId: "req-1",
        response: "MAYBE",
      }),
    );

    expect(response.status).toBe(400);
    expect(respondMock).not.toHaveBeenCalled();
  });

  it("allows accepting without text and forwards undefined text", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    respondMock.mockResolvedValue({
      recommendation: makeRecommendation({ text: "" }),
      request: makeRequest({ status: "ACCEPTED" }),
    });

    const response = await respondPost(
      postJson("http://localhost/api/recommendations/respond", {
        requestId: "req-1",
        response: "ACCEPTED",
      }),
    );

    expect(response.status).toBe(200);
    expect(respondMock.mock.calls[0]?.[0]?.text).toBeUndefined();
  });
});

describe("POST /api/recommendations/report", () => {
  it("reports a visible recommendation", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    reportMock.mockResolvedValue(makeRecommendation({ status: "VISIBLE" }));

    const response = await reportPost(
      postJson("http://localhost/api/recommendations/report", {
        reason: "Inappropriate content.",
        recommendationId: "rec-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(reportMock.mock.calls[0]?.[0]).toMatchObject({
      actorUserId: "user-1",
      recommendationId: "rec-1",
    });
  });

  it("returns 400 when reporting a non-visible recommendation", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    reportMock.mockRejectedValue(new Error("Only visible recommendations can be reported."));

    const response = await reportPost(
      postJson("http://localhost/api/recommendations/report", { recommendationId: "rec-1" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 403 when the reporter is not UoM verified", async () => {
    requireVolunteerMock.mockRejectedValue(
      new Error("Verified UoM email is required before volunteering."),
    );

    const response = await reportPost(
      postJson("http://localhost/api/recommendations/report", { recommendationId: "rec-1" }),
    );

    expect(response.status).toBe(403);
  });
});

describe("POST /api/recommendations/hide", () => {
  it("returns 403 for a non-admin user", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin access required."));

    const response = await hidePost(
      postJson("http://localhost/api/recommendations/hide", { recommendationId: "rec-1" }),
    );

    expect(response.status).toBe(403);
    expect(hideMock).not.toHaveBeenCalled();
  });

  it("hides a recommendation for an admin", async () => {
    requireAdminMock.mockResolvedValue(makeSessionUser({ isAdmin: true }));
    hideMock.mockResolvedValue(makeRecommendation({ status: "HIDDEN" }));

    const response = await hidePost(
      postJson("http://localhost/api/recommendations/hide", {
        reason: "Policy violation.",
        recommendationId: "rec-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(hideMock.mock.calls[0]?.[0]).toMatchObject({ recommendationId: "rec-1" });
  });

  it("returns 400 for an invalid body", async () => {
    requireAdminMock.mockResolvedValue(makeSessionUser({ isAdmin: true }));

    const response = await hidePost(
      postJson("http://localhost/api/recommendations/hide", {}),
    );

    expect(response.status).toBe(400);
    expect(hideMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/recommendations/dismiss-report", () => {
  it("returns 403 for a non-admin user", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin access required."));

    const response = await dismissPost(
      postJson("http://localhost/api/recommendations/dismiss-report", {
        recommendationId: "rec-1",
      }),
    );

    expect(response.status).toBe(403);
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it("dismisses a report for an admin", async () => {
    requireAdminMock.mockResolvedValue(makeSessionUser({ isAdmin: true }));
    dismissMock.mockResolvedValue(makeRecommendation({ status: "VISIBLE" }));

    const response = await dismissPost(
      postJson("http://localhost/api/recommendations/dismiss-report", {
        recommendationId: "rec-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(dismissMock.mock.calls[0]?.[0]).toMatchObject({ recommendationId: "rec-1" });
  });
});

describe("GET /api/admin/recommendations/reported", () => {
  it("returns 403 for a non-admin user", async () => {
    requireAdminMock.mockRejectedValue(new Error("Admin access required."));

    const response = await reportedGet();

    expect(response.status).toBe(403);
    expect(listReportedMock).not.toHaveBeenCalled();
  });

  it("returns reported recommendations for an admin", async () => {
    requireAdminMock.mockResolvedValue(makeSessionUser({ isAdmin: true }));
    const reported: RecommendationWithProfiles[] = [
      { ...makeRecommendation({ status: "REPORTED" }), requester: null, respondent: null },
    ];
    listReportedMock.mockResolvedValue(reported);

    const response = await reportedGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendations).toHaveLength(1);
  });
});
