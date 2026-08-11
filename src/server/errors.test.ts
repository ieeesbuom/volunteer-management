import { describe, expect, it } from "vitest";
import { AppwriteException } from "node-appwrite";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  isExpectedRouteError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";

describe("isExpectedRouteError", () => {
  it("treats domain and validation errors as expected", () => {
    expect(isExpectedRouteError(new ValidationError("Invalid event."))).toBe(true);
    expect(isExpectedRouteError(new ForbiddenError("Admin access required."))).toBe(true);
    expect(isExpectedRouteError(new NotFoundError("Missing."))).toBe(true);
    expect(isExpectedRouteError(new ConflictError("Already exists."))).toBe(true);

    try {
      z.string().parse(1);
    } catch (error) {
      expect(isExpectedRouteError(error)).toBe(true);
    }
  });

  it("does not report duplicate extra scores or unauthenticated calls", () => {
    expect(
      isExpectedRouteError(
        new Error("An extra score evaluation has already been given to this volunteer for this event."),
      ),
    ).toBe(true);
    expect(isExpectedRouteError(new Error("Authentication required."))).toBe(true);
  });

  it("reports unexpected programming and infrastructure failures", () => {
    expect(isExpectedRouteError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isExpectedRouteError(new Error("APPWRITE_API_KEY_UNAUTHORIZED"))).toBe(false);
    expect(isExpectedRouteError(new AppwriteException("Missing scope", 401))).toBe(false);
  });
});
