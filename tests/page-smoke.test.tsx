import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "./fixtures";
import type { SessionUser } from "../src/features/access-control/types";
import type { RecommendationWithProfiles, RecommendationWithRespondent } from "../src/features/recommendations/types";
import type { VolunteerProfileDetails, VolunteerProfileSummary } from "../src/features/volunteers/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/features/access-control/server/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/features/volunteers/server/profiles", () => ({
  getVolunteerProfileDetails: vi.fn(),
  getVolunteerProfileSummary: vi.fn(),
}));

vi.mock("@/features/recommendations/server/recommendations", () => ({
  listRecommendationRequestsForVolunteer: vi.fn(),
  listReportedRecommendations: vi.fn(),
  listVisibleRecommendationsForVolunteer: vi.fn(),
}));

import AdminRecommendationsPage from "../src/app/admin/recommendations/page";
import MyVolunteerProfilePage from "../src/app/volunteers/me/page";
import VolunteerProfilePage from "../src/app/volunteers/[userId]/page";
import { getCurrentUser } from "@/features/access-control/server/current-user";
import {
  getVolunteerProfileDetails,
  getVolunteerProfileSummary,
} from "@/features/volunteers/server/profiles";
import {
  listRecommendationRequestsForVolunteer,
  listReportedRecommendations,
  listVisibleRecommendationsForVolunteer,
} from "@/features/recommendations/server/recommendations";

const getCurrentUserMock = vi.mocked(getCurrentUser);
const getDetailsMock = vi.mocked(getVolunteerProfileDetails);
const getSummaryMock = vi.mocked(getVolunteerProfileSummary);
const listRequestsMock = vi.mocked(listRecommendationRequestsForVolunteer);
const listReportedMock = vi.mocked(listReportedRecommendations);
const listVisibleMock = vi.mocked(listVisibleRecommendationsForVolunteer);

function profileDetails(overrides: Partial<VolunteerProfileDetails> = {}): VolunteerProfileDetails {
  return {
    $id: "details-1",
    batchYear: "2024",
    bio: "Builds calm volunteer systems.",
    createdAt: "2026-01-01T00:00:00.000Z",
    department: "Computer Science",
    faculty: "Engineering",
    headline: "Logistics lead",
    ieeeMembership: "Student Member",
    linkedinUrl: "https://www.linkedin.com/in/test",
    skills: "Planning, mentoring",
    universityIndex: "220000A",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "user-2",
    ...overrides,
  };
}

function profileSummary(
  overrides: Partial<VolunteerProfileSummary> = {},
): VolunteerProfileSummary {
  return {
    details: profileDetails(),
    eventRoles: [],
    googleEmail: "target@gmail.com",
    isPrivateView: false,
    name: "Target Volunteer",
    sbRoles: [],
    uomEmail: "target@uom.lk",
    userId: "user-2",
    ...overrides,
  };
}

function recommendation(
  overrides: Partial<RecommendationWithRespondent> = {},
): RecommendationWithRespondent {
  return {
    $id: "rec-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    requestId: "req-1",
    requesterId: "user-2",
    respondent: {
      googleEmail: "writer@gmail.com",
      name: "Recommendation Writer",
      uomEmail: "writer@uom.lk",
      userId: "user-3",
    },
    respondentId: "user-3",
    status: "VISIBLE",
    text: "Thoughtful and reliable.",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function reportedRecommendation(
  overrides: Partial<RecommendationWithProfiles> = {},
): RecommendationWithProfiles {
  return {
    ...recommendation(),
    reportReason: "Needs review",
    reportedAt: "2026-01-02T00:00:00.000Z",
    reportedBy: "reporter-1",
    requester: {
      googleEmail: "target@gmail.com",
      name: "Target Volunteer",
      uomEmail: "target@uom.lk",
      userId: "user-2",
    },
    respondent: {
      googleEmail: "writer@gmail.com",
      name: "Recommendation Writer",
      uomEmail: "writer@uom.lk",
      userId: "user-3",
    },
    status: "REPORTED",
    ...overrides,
  };
}

async function htmlFrom(element: React.ReactElement | Promise<React.ReactElement>) {
  const resolvedElement = await element;

  return new Promise<string>((resolve, reject) => {
    let html = "";
    let settled = false;
    const output = new PassThrough();

    output.setEncoding("utf8");
    output.on("data", (chunk) => {
      html += chunk;
    });
    output.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(html);
      }
    });
    output.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    const { pipe } = renderToPipeableStream(resolvedElement, {
      onAllReady() {
        pipe(output);
      },
      onError(error) {
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
    });
  });
}

function routeParams(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe("volunteer profile page smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the private my-profile editing surface for a verified volunteer", async () => {
    getCurrentUserMock.mockResolvedValue(makeSessionUser());
    getDetailsMock.mockResolvedValue(profileDetails({ userId: "user-1" }));
    listRequestsMock.mockResolvedValue({ incoming: [], outgoing: [] });

    const html = await htmlFrom(MyVolunteerProfilePage());

    expect(html).toContain("Volunteer Profile");
    expect(html).toContain("Profile Details");
    expect(html).toContain("University Index");
    expect(html).toContain("Recommendation Requests");
    expect(getDetailsMock).toHaveBeenCalledWith("user-1");
    expect(listRequestsMock).toHaveBeenCalledWith("user-1");
  });

  it("renders public volunteer profiles without private identifiers or recommendation text", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    getSummaryMock.mockResolvedValue(profileSummary({ isPrivateView: false }));

    const html = await htmlFrom(VolunteerProfilePage(routeParams("user-2")));

    expect(html).toContain("Target Volunteer");
    expect(html).toContain("Academic identifiers are visible only to the profile owner and admins.");
    expect(html).toContain("Recommendations are visible only to the profile owner and admins.");
    expect(html).not.toContain("target@uom.lk");
    expect(html).not.toContain("220000A");
    expect(listVisibleMock).not.toHaveBeenCalled();
  });

  it("renders private volunteer profiles with identifiers, roles, and recommendations", async () => {
    const admin = makeSessionUser({ isAdmin: true });
    getCurrentUserMock.mockResolvedValue(admin);
    getSummaryMock.mockResolvedValue(
      profileSummary({
        eventRoles: [{ committeeName: "Ops", eventId: "event-1", eventTitle: "Tech Week", role: "Lead" }],
        isPrivateView: true,
        sbRoles: ["Chair"],
      }),
    );
    listVisibleMock.mockResolvedValue([recommendation()]);

    const html = await htmlFrom(VolunteerProfilePage(routeParams("user-2")));

    expect(html).toContain("target@uom.lk");
    expect(html).toContain("220000A");
    expect(html).toContain("Chair");
    expect(html).toContain("Tech Week");
    expect(html).toContain("Thoughtful and reliable.");
    expect(listVisibleMock).toHaveBeenCalledWith("user-2");
  });

  it("shows the public not-found state without redirecting anonymous viewers", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    getSummaryMock.mockResolvedValue(null);

    const html = await htmlFrom(VolunteerProfilePage(routeParams("missing-user")));

    expect(html).toContain("Volunteer Not Found");
    expect(html).toContain("No active verified volunteer profile exists for this user ID.");
  });
});

describe("admin recommendation moderation page smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated viewers to login", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(AdminRecommendationsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(listReportedMock).not.toHaveBeenCalled();
  });

  it("redirects non-admin users away from moderation", async () => {
    getCurrentUserMock.mockResolvedValue(makeSessionUser());

    await expect(AdminRecommendationsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(listReportedMock).not.toHaveBeenCalled();
  });

  it("renders reported recommendations for admins", async () => {
    getCurrentUserMock.mockResolvedValue(makeSessionUser({ isAdmin: true } satisfies Partial<SessionUser>));
    listReportedMock.mockResolvedValue([reportedRecommendation()]);

    const html = await htmlFrom(AdminRecommendationsPage());

    expect(html).toContain("Recommendation Moderation");
    expect(html).toContain("Reported Recommendations");
    expect(html).toContain("Thoughtful and reliable.");
    expect(html).toContain("Needs review");
    expect(html).toContain("Dismiss Report");
    expect(html).toContain("Hide Content");
  });
});
