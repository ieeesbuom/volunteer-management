import { describe, expect, it } from "vitest";
import {
  defaultGroupAnswersForPurpose,
  getLavaFormPreset,
  isOperationalFormPurpose,
} from "../src/features/forms/lib/lava-form-presets";
import type { FormConnectionPurpose } from "../src/features/forms/types";

describe("lava form presets", () => {
  const purposes: FormConnectionPurpose[] = [
    "registration",
    "feedback",
    "attendance",
    "grading",
    "grant_request",
    "tshirt_order",
    "oc_progress",
    "team_registration",
    "other",
  ];

  it("returns unique field keys for every purpose", () => {
    for (const purpose of purposes) {
      const preset = getLavaFormPreset(purpose);
      const keys = preset.fields.map((field) => `${field.scope}:${field.key}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(preset.fields.length).toBeGreaterThan(0);
    }
  });

  it("defaults group answers only for team registration", () => {
    expect(defaultGroupAnswersForPurpose("team_registration")).toBe(true);
    expect(defaultGroupAnswersForPurpose("registration")).toBe(false);
    expect(defaultGroupAnswersForPurpose("grant_request")).toBe(false);
  });

  it("uses member-scoped fields for team registration when group answers are on", () => {
    const preset = getLavaFormPreset("team_registration", true);
    expect(preset.teamMinMembers).toBe(2);
    expect(preset.teamMaxMembers).toBe(5);
    expect(preset.fields.some((field) => field.key === "team_name" && field.scope === "submission")).toBe(
      true,
    );
    expect(preset.fields.some((field) => field.key === "member_name" && field.scope === "member")).toBe(
      true,
    );
    expect(preset.fields.some((field) => field.key === "member_email" && field.scope === "member")).toBe(
      true,
    );
  });

  it("keeps solo team sizes at 1", () => {
    const preset = getLavaFormPreset("registration", false);
    expect(preset.teamMinMembers).toBe(1);
    expect(preset.teamMaxMembers).toBe(1);
  });

  it("marks operational purposes for dashboard filtering", () => {
    expect(isOperationalFormPurpose("oc_progress")).toBe(true);
    expect(isOperationalFormPurpose("feedback")).toBe(true);
    expect(isOperationalFormPurpose("grant_request")).toBe(false);
    expect(isOperationalFormPurpose("tshirt_order")).toBe(false);
    expect(isOperationalFormPurpose("team_registration")).toBe(false);
  });
});
