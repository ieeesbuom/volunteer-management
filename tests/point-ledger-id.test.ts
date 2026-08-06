import { describe, expect, it } from "vitest";
import {
  isDeterministicPointLedgerRowId,
  pointLedgerRowId,
} from "@/features/scoring/lib/point-ledger-id";

describe("point ledger ids", () => {
  it("derives deterministic pl_ row ids", () => {
    const rowId = pointLedgerRowId("user-1", "event-1", "grade");

    expect(rowId.startsWith("pl_")).toBe(true);
    expect(isDeterministicPointLedgerRowId(rowId)).toBe(true);
    expect(isDeterministicPointLedgerRowId("legacy-random-id")).toBe(false);
  });
});
