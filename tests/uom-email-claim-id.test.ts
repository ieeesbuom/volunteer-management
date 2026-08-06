import { describe, expect, it } from "vitest";
import {
  uomEmailClaimRowId,
  uomEmailClaimSettingKey,
} from "@/features/access-control/lib/uom-email-claim-id";

describe("uom email claim ids", () => {
  it("uses a stable logical setting key", () => {
    expect(uomEmailClaimSettingKey("user@uom.lk")).toBe("uom_email_claim:user@uom.lk");
  });

  it("uses an appwrite-safe hashed row id without @ or colon", () => {
    const rowId = uomEmailClaimRowId("user@uom.lk");

    expect(rowId.startsWith("uec_")).toBe(true);
    expect(rowId).not.toContain("@");
    expect(rowId).not.toContain(":");
    expect(rowId.length).toBeLessThanOrEqual(32);
  });
});
