import { describe, expect, it } from "vitest";
import { getPublicAppOrigin } from "@/server/public-origin";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

function createRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: new Headers(headers) });
}

describe("Penetration & Security Testing: Auth & Origin", () => {
  it("prevents host header injection and open redirect attacks", () => {
    const maliciousHosts = [
      "evil.com",
      "attacker.org",
      "voluntieee.knurdz.org.attacker.com",
      "192.168.1.1",
      "google.com",
      "evil-knurdz.org",
    ];

    for (const evilHost of maliciousHosts) {
      const origin = getPublicAppOrigin(
        createRequest("http://127.0.0.1:3000/api/auth/google", {
          host: evilHost,
          "x-forwarded-host": evilHost,
          "x-forwarded-proto": "https",
        }),
      );

      // Must never return the attacker's domain!
      expect(origin).not.toContain(evilHost);
      expect(origin).toBe("https://voluntieee.knurdz.org");
    }
  });

  it("safely permits legitimate domains and subdomains", () => {
    const allowed = [
      { host: "voluntieee.knurdz.org", expected: "https://voluntieee.knurdz.org" },
      { host: "dev.knurdz.org", expected: "https://dev.knurdz.org" },
      { host: "localhost:3000", expected: "http://localhost:3000" },
      { host: "127.0.0.1:3000", expected: "http://127.0.0.1:3000" },
    ];

    for (const { host, expected } of allowed) {
      const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const proto = isLocal ? "http" : "https";
      const origin = getPublicAppOrigin(
        createRequest(`http://${host}/api/auth/google`, {
          host,
          "x-forwarded-host": host,
          "x-forwarded-proto": proto,
        }),
      );

      expect(origin).toBe(expected);
    }
  });

  it("validates Supabase RLS policies block anonymous data manipulation", async () => {
    const envFile = fs.readFileSync(".env", "utf8");
    const getEnv = (key: string) => {
      const match = envFile.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : "";
    };

    const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    expect(url).toBeTruthy();
    expect(anonKey).toBeTruthy();

    const anonClient = createClient(url, anonKey);

    // 1. Anonymous read on audit_logs must return empty or fail
    const auditRes = await anonClient.from("audit_logs").select("*").limit(5);
    expect(auditRes.data?.length ?? 0).toBe(0);

    // 2. Anonymous write on profiles must be blocked by RLS
    const insertRes = await anonClient.from("profiles").insert({
      id: "hacker_test",
      authUserId: "hacker_test",
      googleEmail: "hacker@evil.com",
      status: "ACTIVE",
    });
    expect(insertRes.error).not.toBeNull();

    // 3. Anonymous write on system_settings must be blocked by RLS
    const settingsRes = await anonClient.from("system_settings").insert({
      id: "hacker_setting",
      key: "active_term_id",
      value: "hacked",
    });
    expect(settingsRes.error).not.toBeNull();
  });
});
