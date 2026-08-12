import "server-only";

import { TooManyRequestsError } from "@/server/errors";

/**
 * In-memory fixed-window rate limiter (per server instance).
 * For multi-instance deployments, replace with a shared store (e.g. Redis).
 */

type Bucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function rateLimitKey(scope: string, identifier: string) {
  return `${scope}:${identifier}`;
}

export function checkRateLimit(key: string, config: RateLimitConfig): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= config.windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return;
  }

  if (existing.count >= config.limit) {
    throw new TooManyRequestsError("Too many requests. Please try again later.");
  }

  existing.count += 1;
}

export function enforceRateLimit(
  key: string,
  config: RateLimitConfig,
  message = "Too many requests. Please try again later.",
): void {
  try {
    checkRateLimit(key, config);
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      throw new TooManyRequestsError(message);
    }
    throw error;
  }
}

/** Cooldown: at most one successful window reset per key within windowMs. */
export function enforceCooldown(key: string, cooldownMs: number, message?: string): void {
  enforceRateLimit(key, { limit: 1, windowMs: cooldownMs }, message);
}

export const RATE_LIMITS = {
  authGooglePerIp: { limit: 30, windowMs: 60_000 },
  uomVerificationRequestPerUser: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  uomVerificationConfirmPerUser: { limit: 30, windowMs: 60 * 60 * 1000 },
  recommendationWritePerUser: { limit: 20, windowMs: 60 * 60 * 1000 },
  leaderboardPerUser: { limit: 60, windowMs: 60_000 },
  internalJobPerIp: { limit: 30, windowMs: 60_000 },
  profileAvatarWritePerUser: { limit: 10, windowMs: 60 * 60 * 1000 },
  profileAvatarReadPerIp: { limit: 120, windowMs: 60_000 },
  lavaFormSubmitPerUser: { limit: 30, windowMs: 60 * 60 * 1000 },
  lavaFormManagePerUser: { limit: 60, windowMs: 60 * 60 * 1000 },
  lavaFormFileReadPerIp: { limit: 120, windowMs: 60_000 },
} as const;
