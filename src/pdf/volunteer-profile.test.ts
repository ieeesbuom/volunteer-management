import { describe, expect, it } from "vitest";
import { buildVolunteerProfilePdf } from "@/pdf/volunteer-profile";

describe("volunteer profile pdf", () => {
  it("builds a non-empty pdf buffer from real profile fields", async () => {
    const result = await buildVolunteerProfilePdf({
      googleEmail: "volunteer@example.com",
      name: "Test Volunteer",
      participations: [
        {
          assignedAt: "2026-01-01T00:00:00.000Z",
          committeeName: "Program",
          eventTitle: "IEEE Day",
          role: "Committee Lead",
        },
      ],
      recommendations: [],
      sbRoles: ["SB Member"],
      uomEmail: "volunteer@uom.lk",
    });

    expect(result.filename).toBe("volunteer-test-volunteer.pdf");
    expect(result.buffer.byteLength).toBeGreaterThan(500);
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
