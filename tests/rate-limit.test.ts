import { describe, expect, it } from "vitest";
import { TooManyRequestsError } from "@/server/errors";
import { checkRateLimit, enforceRateLimit } from "@/server/rate-limit";

describe("rate-limit", () => {
  it("allows requests within the limit", () => {
    const key = `test-${Date.now()}-allow`;
    expect(() => checkRateLimit(key, { limit: 2, windowMs: 60_000 })).not.toThrow();
    expect(() => checkRateLimit(key, { limit: 2, windowMs: 60_000 })).not.toThrow();
  });

  it("throws when the limit is exceeded", () => {
    const key = `test-${Date.now()}-block`;
    checkRateLimit(key, { limit: 1, windowMs: 60_000 });
    expect(() => enforceRateLimit(key, { limit: 1, windowMs: 60_000 })).toThrow(
      TooManyRequestsError,
    );
  });
});
