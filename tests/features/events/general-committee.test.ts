import { describe, expect, it } from "vitest";
import {
  isGeneralCommittee,
  sortCommitteesGeneralFirst,
} from "@/features/events/lib/general-committee";

describe("general committee helpers", () => {
  it("recognizes only the exact General name", () => {
    expect(isGeneralCommittee("General")).toBe(true);
    expect(isGeneralCommittee("general")).toBe(false);
    expect(isGeneralCommittee("General Committee")).toBe(false);
  });

  it("pins General first and keeps other names sorted", () => {
    expect(
      sortCommitteesGeneralFirst([
        { name: "Publicity Committee" },
        { name: "Design Committee" },
        { name: "General" },
      ]).map((committee) => committee.name),
    ).toEqual(["General", "Design Committee", "Publicity Committee"]);
  });
});
