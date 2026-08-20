import { describe, expect, it } from "vitest";
import { AppwriteException } from "node-appwrite";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  isAppwriteUnauthorized,
  isExpectedRouteError,
  isInvalidOAuthRedirect,
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

describe("Appwrite auth error helpers", () => {
  it("detects unauthorized Appwrite errors without relying on instanceof", () => {
    expect(
      isAppwriteUnauthorized({
        code: 401,
        type: "user_unauthorized",
        message: "The current user is not authorized to perform the requested action.",
      }),
    ).toBe(true);
    expect(isAppwriteUnauthorized(new AppwriteException("Missing scope", 401))).toBe(false);
  });

  it("detects Appwrite OAuth invalid redirects", () => {
    expect(isInvalidOAuthRedirect(new AppwriteException("Invalid redirect", 400))).toBe(true);
    expect(isInvalidOAuthRedirect(new Error("Invalid redirect"))).toBe(true);
    expect(isInvalidOAuthRedirect(new Error("Something else"))).toBe(false);
  });
});
