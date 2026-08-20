import "server-only";

import { PRODUCTION_APP_ORIGIN } from "@/lib/appwrite/constants";

/**
 * Resolve the public app origin for OAuth redirects behind reverse proxies.
 * Prefers a configured public URL, then non-Vercel request hosts, then the
 * production custom domain. Vercel deployment hosts are never sent to Appwrite.
 */
export function getPublicAppOrigin(request: Request): string {
  const configuredAppUrl = parseOrigin(process.env.APP_URL);

  if (configuredAppUrl && !isVercelAppOrigin(configuredAppUrl)) {
    return configuredAppUrl;
  }

  const headerHost = firstHeaderValue(request.headers.get("x-forwarded-host"))
    || request.headers.get("host")?.trim();
  const headerOrigin = headerHost
    ? originFromHost(headerHost, firstHeaderValue(request.headers.get("x-forwarded-proto")))
    : undefined;

  if (headerOrigin && !isVercelAppOrigin(headerOrigin)) {
    return headerOrigin;
  }

  const productionOrigin = getProductionPublicOrigin();

  if (headerOrigin || configuredAppUrl || isProductionRuntime()) {
    return productionOrigin;
  }

  const requestOrigin = new URL(request.url).origin;

  if (isVercelAppOrigin(requestOrigin)) {
    return productionOrigin;
  }

  return requestOrigin;
}

function getProductionPublicOrigin() {
  const candidates = [
    hostToHttpsOrigin(process.env.APPWRITE_PRODUCTION_HOSTNAME),
    hostToHttpsOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ];

  for (const value of candidates) {
    const origin = parseOrigin(value);

    if (origin && !isVercelAppOrigin(origin)) {
      return origin;
    }
  }

  return PRODUCTION_APP_ORIGIN;
}

function parseOrigin(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

function hostToHttpsOrigin(value?: string) {
  const host = value?.trim().replace(/^https?:\/\//, "").split("/")[0];

  return host ? `https://${host}` : undefined;
}

function originFromHost(host: string, protocolHint?: string) {
  const protocol =
    protocolHint
    || (isLocalHost(host) ? "http" : "https");

  return `${protocol}://${host}`;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function isLocalHost(host: string) {
  const hostname = host.split(":")[0];

  return hostname === "localhost" || hostname.startsWith("127.0.0.1");
}

function isVercelAppOrigin(originOrHost: string) {
  const hostname = originOrHost.includes("://")
    ? new URL(originOrHost).hostname
    : originOrHost.split(":")[0];

  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}
