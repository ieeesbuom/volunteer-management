import { describe, expect, it } from "vitest";
import { safeDigestEquals, safeTokenEquals } from "@/server/tokens";

describe("safeTokenEquals", () => {
  it("returns true for matching tokens", () => {
    expect(safeTokenEquals("secret-token", "secret-token")).toBe(true);
  });

  it("returns false for mismatched tokens", () => {
    expect(safeTokenEquals("wrong", "secret-token")).toBe(false);
  });
});

describe("safeDigestEquals", () => {
  it("compares digests in constant time shape", () => {
    const digest = "a".repeat(64);
    expect(safeDigestEquals(digest, digest)).toBe(true);
    expect(safeDigestEquals("b".repeat(64), digest)).toBe(false);
  });
});
