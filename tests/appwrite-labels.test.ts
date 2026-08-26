import { describe, expect, it } from "vitest";
import {
  ADMIN_LABEL,
  buildSyncedLabels,
  isAdminLabel,
  labelToSbRole,
  mergeSbRoles,
  resolveIsAdmin,
  sbRoleToLabel,
  sbRolesFromLabels,
} from "../src/features/access-control/lib/appwrite-labels";

describe("appwrite labels", () => {
  it("maps SB roles to alphanumeric labels under 36 chars", () => {
    for (const role of [
      "Chairperson",
      "Vice Chairperson",
      "Assistant Secretary",
      "SB Lead",
      "SB Member",
    ] as const) {
      const label = sbRoleToLabel(role);
      expect(label).toMatch(/^sb[A-Za-z0-9]+$/);
      expect(label.length).toBeLessThanOrEqual(36);
      expect(labelToSbRole(label)).toBe(role);
    }
  });

  it("ignores unknown and event-like labels when deriving SB roles", () => {
    expect(
      sbRolesFromLabels(["admin", "eventHackChair", "sbWebmaster", "customTag"]),
    ).toEqual(["Webmaster"]);
  });

  it("OR-merges table SB roles with label-derived roles", () => {
    expect(mergeSbRoles(["SB Member"], [])).toEqual(["SB Member"]);
    expect(mergeSbRoles([], ["sbChairperson"])).toEqual(["Chairperson"]);
    expect(mergeSbRoles(["SB Member"], ["sbChairperson", "sbSBMember"])).toEqual([
      "SB Member",
      "Chairperson",
    ]);
    expect(mergeSbRoles(["Editor"], undefined)).toEqual(["Editor"]);
  });

  it("resolves admin via email OR admin label", () => {
    expect(
      resolveIsAdmin({
        email: "admin@example.com",
        adminEmail: "admin@example.com",
        labels: [],
      }),
    ).toBe(true);
    expect(
      resolveIsAdmin({
        email: "other@example.com",
        adminEmail: "admin@example.com",
        labels: [ADMIN_LABEL],
      }),
    ).toBe(true);
    expect(
      resolveIsAdmin({
        email: "other@example.com",
        adminEmail: "admin@example.com",
        labels: ["sbWebmaster"],
      }),
    ).toBe(false);
    expect(isAdminLabel(["sbWebmaster"])).toBe(false);
    expect(isAdminLabel([ADMIN_LABEL])).toBe(true);
  });

  it("syncs managed labels while preserving unknown ones", () => {
    expect(
      buildSyncedLabels({
        currentLabels: ["customTag", "sbEditor", ADMIN_LABEL],
        isAdmin: false,
        sbRoles: ["Webmaster"],
      }),
    ).toEqual(["customTag", "sbWebmaster"]);

    expect(
      buildSyncedLabels({
        currentLabels: ["customTag"],
        isAdmin: true,
        sbRoles: ["SB Lead"],
      }),
    ).toEqual(["customTag", ADMIN_LABEL, "sbSBLead"]);
  });
});
