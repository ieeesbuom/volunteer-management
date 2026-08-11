import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubSentryEvent } from "@/lib/sentry-privacy";

describe("scrubSentryEvent", () => {
  it("strips cookies, auth headers, Appwrite keys, emails, and request bodies", () => {
    const event = scrubSentryEvent({
      message: "Failed for chair@uom.lk",
      request: {
        cookies: { session: "abc" },
        headers: {
          Authorization: "Bearer secret",
          Cookie: "a=1",
          "X-Appwrite-Key": "key",
        },
        data: { uomEmail: "student@uom.lk", notes: "hello" },
        url: "https://example.com/api?email=a@uom.lk",
      },
      user: {
        email: "student@uom.lk",
        id: "user_1",
      },
      extra: {
        uomEmail: "student@uom.lk",
        body: { password: "x" },
      },
    } as unknown as ErrorEvent);

    expect(event.message).toBe("Failed for [email]");
    expect(event.request?.cookies).toEqual({});
    expect(event.request?.headers?.Authorization).toBe("[Filtered]");
    expect(event.request?.headers?.Cookie).toBe("[Filtered]");
    expect(event.request?.headers?.["X-Appwrite-Key"]).toBe("[Filtered]");
    expect(event.request?.data).toBe("[Filtered]");
    expect(event.request?.url).toBe("https://example.com/api?email=[email]");
    expect(event.user).toEqual({ id: "user_1" });
    expect(event.extra).toEqual({
      uomEmail: "[Filtered]",
      body: "[Filtered]",
    });
  });
});
