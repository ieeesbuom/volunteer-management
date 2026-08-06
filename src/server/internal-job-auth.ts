import "server-only";

import { getServerEnv } from "@/lib/env";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { enforceRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from "@/server/rate-limit";
import { safeTokenEquals } from "@/server/tokens";

export function assertTrustedJobRequest(request: Request) {
  enforceRateLimit(
    rateLimitKey("internal-job", getClientIp(request)),
    RATE_LIMITS.internalJobPerIp,
  );

  const token = getServerEnv().INTERNAL_JOB_TOKEN;

  if (!token) {
    throw new ValidationError("INTERNAL_JOB_TOKEN must be configured before running jobs.");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const headerToken = request.headers.get("x-internal-job-token") ?? "";

  const bearerMatches = bearerToken.length > 0 && safeTokenEquals(bearerToken, token);
  const headerMatches = headerToken.length > 0 && safeTokenEquals(headerToken, token);

  if (!bearerMatches && !headerMatches) {
    throw new ForbiddenError("Job token is invalid.");
  }
}

export async function readOptionalJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}
