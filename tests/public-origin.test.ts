import { afterEach, describe, expect, it } from "vitest";
import { getPublicAppOrigin } from "@/server/public-origin";

function createRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: new Headers(headers) });
}

describe("getPublicAppOrigin", () => {
  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("prefers APP_URL over forwarded headers and request URL", () => {
    process.env.APP_URL = "https://ieeevm.knurdz.org";

    const origin = getPublicAppOrigin(
      createRequest("http://127.0.0.1:3000/api/auth/google", {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "internal.example.com",
        "x-forwarded-proto": "http",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("uses forwarded host and proto when APP_URL is unset", () => {
    const origin = getPublicAppOrigin(
      createRequest("http://127.0.0.1:3000/api/auth/google", {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "ieeevm.knurdz.org",
        "x-forwarded-proto": "https",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("uses the first forwarded host when multiple values are present", () => {
    const origin = getPublicAppOrigin(
      createRequest("http://127.0.0.1:3000/api/auth/google", {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "ieeevm.knurdz.org, internal.example.com",
        "x-forwarded-proto": "https, http",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("falls back to host header with https for non-local hosts", () => {
    const origin = getPublicAppOrigin(
      createRequest("http://127.0.0.1:3000/api/auth/google", {
        host: "ieeevm.knurdz.org",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("falls back to request URL origin when no host headers exist", () => {
    const origin = getPublicAppOrigin(createRequest("http://localhost:3000/api/auth/google"));

    expect(origin).toBe("http://localhost:3000");
  });
});
