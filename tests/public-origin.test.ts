import { afterEach, describe, expect, it } from "vitest";
import { getPublicAppOrigin } from "@/server/public-origin";

function createRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: new Headers(headers) });
}

describe("getPublicAppOrigin", () => {
  const originalEnv = {
    APP_URL: process.env.APP_URL,
    APPWRITE_PRODUCTION_HOSTNAME: process.env.APPWRITE_PRODUCTION_HOSTNAME,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  };

  afterEach(() => {
    restoreEnv("APP_URL", originalEnv.APP_URL);
    restoreEnv("APPWRITE_PRODUCTION_HOSTNAME", originalEnv.APPWRITE_PRODUCTION_HOSTNAME);
    restoreEnv("NODE_ENV", originalEnv.NODE_ENV);
    restoreEnv("VERCEL_ENV", originalEnv.VERCEL_ENV);
    restoreEnv("VERCEL_PROJECT_PRODUCTION_URL", originalEnv.VERCEL_PROJECT_PRODUCTION_URL);
  });

  it("prefers APP_URL over forwarded headers and request URL", () => {
    process.env.APP_URL = "https://ieeevm.knurdz.org";
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

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
    delete process.env.APP_URL;
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

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
    delete process.env.APP_URL;
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

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
    delete process.env.APP_URL;
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    const origin = getPublicAppOrigin(
      createRequest("http://127.0.0.1:3000/api/auth/google", {
        host: "ieeevm.knurdz.org",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("falls back to request URL origin when no host headers exist", () => {
    delete process.env.APP_URL;
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    const origin = getPublicAppOrigin(createRequest("http://localhost:3000/api/auth/google"));

    expect(origin).toBe("http://localhost:3000");
  });

  it("ignores Vercel deployment hosts and uses the production custom domain", () => {
    delete process.env.APP_URL;
    delete process.env.APPWRITE_PRODUCTION_HOSTNAME;
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ieeevm.knurdz.org";

    const origin = getPublicAppOrigin(
      createRequest("https://volunteer-management-drab.vercel.app/api/auth/google", {
        host: "volunteer-management-drab.vercel.app",
        "x-forwarded-host": "volunteer-management-drab.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });

  it("does not send a vercel.app APP_URL to Appwrite when a custom domain exists", () => {
    process.env.APP_URL = "https://volunteer-management-drab.vercel.app";
    process.env.APPWRITE_PRODUCTION_HOSTNAME = "ieeevm.knurdz.org";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    const origin = getPublicAppOrigin(
      createRequest("https://volunteer-management-drab.vercel.app/api/auth/google", {
        host: "volunteer-management-drab.vercel.app",
      }),
    );

    expect(origin).toBe("https://ieeevm.knurdz.org");
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
