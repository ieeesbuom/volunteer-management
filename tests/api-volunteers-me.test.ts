import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "./fixtures";

vi.mock("@/features/access-control/server/current-user", () => ({
  requireUomVerifiedVolunteer: vi.fn(),
}));

vi.mock("@/features/volunteers/server/profiles", () => ({
  getVolunteerProfileDetails: vi.fn(),
  upsertMyVolunteerProfileDetails: vi.fn(),
}));

import { GET, PUT } from "../src/app/api/volunteers/me/route";
import { requireUomVerifiedVolunteer } from "@/features/access-control/server/current-user";
import {
  getVolunteerProfileDetails,
  upsertMyVolunteerProfileDetails,
} from "@/features/volunteers/server/profiles";

const requireVolunteerMock = vi.mocked(requireUomVerifiedVolunteer);
const getDetailsMock = vi.mocked(getVolunteerProfileDetails);
const upsertDetailsMock = vi.mocked(upsertMyVolunteerProfileDetails);

const validDetails = {
  batchYear: "2024",
  department: "Computer Science",
  faculty: "Engineering",
  linkedinUrl: "https://www.linkedin.com/in/test",
  universityIndex: "240000A",
};

function putRequest(body: unknown) {
  return new Request("http://localhost/api/volunteers/me", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

describe("/api/volunteers/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the profile details for a verified volunteer", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());
    getDetailsMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ details: null });
    expect(getDetailsMock).toHaveBeenCalledWith("user-1");
  });

  it("returns 401 when the viewer is not authenticated", async () => {
    requireVolunteerMock.mockRejectedValue(new Error("Authentication required."));

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required." });
  });

  it("returns 403 when the volunteer is not UoM verified", async () => {
    requireVolunteerMock.mockRejectedValue(
      new Error("Verified UoM email is required before volunteering."),
    );

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("updates and returns details for a valid PUT body", async () => {
    const user = makeSessionUser();
    requireVolunteerMock.mockResolvedValue(user);
    upsertDetailsMock.mockResolvedValue({
      $id: "details-1",
      batchYear: "2024",
      createdAt: "2026-01-01T00:00:00.000Z",
      department: "Computer Science",
      faculty: "Engineering",
      linkedinUrl: "https://www.linkedin.com/in/test",
      universityIndex: "240000A",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "user-1",
    });

    const response = await PUT(putRequest(validDetails));

    expect(response.status).toBe(200);
    expect(upsertDetailsMock).toHaveBeenCalledTimes(1);
    expect(upsertDetailsMock.mock.calls[0]?.[0]).toMatchObject({
      details: expect.objectContaining({ universityIndex: "240000A" }),
      user,
    });
  });

  it("returns 400 for an invalid PUT body", async () => {
    requireVolunteerMock.mockResolvedValue(makeSessionUser());

    const response = await PUT(putRequest({ bio: "missing required fields" }));

    expect(response.status).toBe(400);
    expect(upsertDetailsMock).not.toHaveBeenCalled();
  });
});
