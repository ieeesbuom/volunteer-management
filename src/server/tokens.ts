import "server-only";

import { timingSafeEqual } from "node:crypto";

export function safeTokenEquals(providedToken: string, configuredToken: string) {
  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);

  if (provided.length !== configured.length) {
    return false;
  }

  return timingSafeEqual(provided, configured);
}

export function safeDigestEquals(providedDigest: string, expectedDigest: string) {
  const provided = Buffer.from(providedDigest, "utf8");
  const expected = Buffer.from(expectedDigest, "utf8");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
