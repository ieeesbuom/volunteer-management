import { describe, expect, it } from "vitest";
import { parseViewModeCookie } from "@/features/access-control/lib/view-mode";
import { isVolunteerPreviewActive } from "@/features/access-control/server/view-mode";

describe("view-mode helper tests", () => {
  it("parses cookies correctly", () => {
    expect(parseViewModeCookie("volunteer")).toBe("volunteer");
    expect(parseViewModeCookie("admin")).toBe("admin");
    expect(parseViewModeCookie(undefined)).toBe("admin");
    expect(parseViewModeCookie(null)).toBe("admin");
    expect(parseViewModeCookie("invalid")).toBe("admin");
  });

  it("isVolunteerPreviewActive returns false for non-admins", async () => {
    expect(await isVolunteerPreviewActive(false)).toBe(false);
  });
});
