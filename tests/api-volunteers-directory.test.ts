import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "./fixtures";

vi.mock("@/features/access-control/server/current-user", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/features/volunteers/server/profiles", () => ({
  listVerifiedVolunteers: vi.fn(),
}));

import { GET } from "../src/app/api/volunteers/route";
import { requireAuth } from "@/features/access-control/server/current-user";
import { listVerifiedVolunteers } from "@/features/volunteers/server/profiles";

const requireAuthMock = vi.mocked(requireAuth);
const listVolunteersMock = vi.mocked(listVerifiedVolunteers);

describe("GET /api/volunteers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requireAuthMock.mockRejectedValue(new Error("Authentication required."));

    const response = await GET(new Request("http://localhost/api/volunteers"));

    expect(response.status).toBe(401);
    expect(listVolunteersMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not a verified volunteer", async () => {
    requireAuthMock.mockResolvedValue(
      makeSessionUser({
        profile: {
          $id: "profile-1",
          authUserId: "user-1",
          googleEmail: "user@gmail.com",
          status: "ACTIVE",
          uomVerified: false,
        },
      }),
    );

    const response = await GET(new Request("http://localhost/api/volunteers"));

    expect(response.status).toBe(403);
    expect(listVolunteersMock).not.toHaveBeenCalled();
  });

  it("returns directory results for verified volunteers", async () => {
    requireAuthMock.mockResolvedValue(makeSessionUser());
    listVolunteersMock.mockResolvedValue({
      items: [
        {
          userId: "user-2",
          name: "Target Volunteer",
          headline: "Logistics lead",
          skills: "Planning",
          eventCount: 3,
        },
      ],
      total: 1,
    });

    const response = await GET(new Request("http://localhost/api/volunteers?q=target&limit=20"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          userId: "user-2",
          name: "Target Volunteer",
          headline: "Logistics lead",
          skills: "Planning",
          eventCount: 3,
        },
      ],
      total: 1,
    });
    expect(listVolunteersMock).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      term: "target",
    });
  });

  it("forwards offset for load-more pagination", async () => {
    requireAuthMock.mockResolvedValue(makeSessionUser());
    listVolunteersMock.mockResolvedValue({
      items: [
        {
          userId: "user-51",
          name: "Next Page Volunteer",
          eventCount: 0,
        },
      ],
      total: 60,
    });

    const response = await GET(
      new Request("http://localhost/api/volunteers?limit=50&offset=50"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          userId: "user-51",
          name: "Next Page Volunteer",
          eventCount: 0,
        },
      ],
      total: 60,
    });
    expect(listVolunteersMock).toHaveBeenCalledWith({
      limit: 50,
      offset: 50,
      term: "",
    });
  });

  it("allows admins without UoM verification", async () => {
    requireAuthMock.mockResolvedValue(
      makeSessionUser({
        isAdmin: true,
        profile: {
          $id: "profile-admin",
          authUserId: "admin-1",
          googleEmail: "admin@gmail.com",
          status: "ACTIVE",
          uomVerified: false,
        },
      }),
    );
    listVolunteersMock.mockResolvedValue({ items: [], total: 0 });

    const response = await GET(new Request("http://localhost/api/volunteers"));

    expect(response.status).toBe(200);
    expect(listVolunteersMock).toHaveBeenCalled();
  });
});
