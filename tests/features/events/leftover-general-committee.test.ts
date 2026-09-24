import { describe, expect, it } from "vitest";
import {
  isLeftoverGeneralCommittee,
  withoutLeftoverGeneralCommittees,
} from "@/features/events/lib/leftover-general-committee";

describe("leftover General committee helper", () => {
  it("matches only the exact leftover General name", () => {
    expect(isLeftoverGeneralCommittee("General")).toBe(true);
    expect(isLeftoverGeneralCommittee("general")).toBe(false);
    expect(isLeftoverGeneralCommittee("General Committee")).toBe(false);
  });

  it("filters leftover General rows from committee lists", () => {
    expect(
      withoutLeftoverGeneralCommittees([
        { name: "Finance Committee" },
        { name: "General" },
        { name: "Design Committee" },
      ]).map((committee) => committee.name),
    ).toEqual(["Finance Committee", "Design Committee"]);
  });
});
