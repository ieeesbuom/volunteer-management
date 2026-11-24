import "server-only";

import { PRODUCTION_APP_HOSTNAME, PRODUCTION_APP_ORIGIN } from "@/lib/appwrite/constants";

/**
 * Resolve the public app origin for OAuth redirects behind reverse proxies.
 * Prefers the current request host if it matches a trusted production or local domain,
 * then a configured public URL, then the production custom domain.
 * Vercel deployment hosts and untrusted/malicious host headers are never sent to OAuth providers.
 */
export function getPublicAppOrigin(request: Request): string {
  const configuredAppUrl = parseOrigin(process.env.APP_URL);

  const rawHeaderHost = firstHeaderValue(request.headers.get("x-forwarded-host"))
    || request.headers.get("host")?.trim();

  // If header host is valid and trusted
  if (rawHeaderHost && isTrustedHost(rawHeaderHost)) {
    const headerOrigin = originFromHost(
      rawHeaderHost,
      firstHeaderValue(request.headers.get("x-forwarded-proto"))
    );

    // If it's a trusted non-Vercel host (e.g. voluntieee.knurdz.org, localhost)
    if (!isVercelAppOrigin(headerOrigin)) {
      // If the request specifically arrived on our production domain, prioritize it
      const headerHostname = rawHeaderHost.split(":")[0].toLowerCase();
      if (headerHostname === PRODUCTION_APP_HOSTNAME) {
        return headerOrigin;
      }

      // If configuredAppUrl is valid and not legacy alias, check if it's set
      if (configuredAppUrl && !isVercelAppOrigin(configuredAppUrl)) {
        const configuredHostname = new URL(configuredAppUrl).hostname.toLowerCase();
        // If configured URL is the old legacy domain while request is on the production domain, use request
        if (configuredHostname !== "ieeevm.knurdz.org" || headerHostname === PRODUCTION_APP_HOSTNAME) {
          return configuredAppUrl;
        }
      }

      return headerOrigin;
    }
  }

  if (configuredAppUrl && !isVercelAppOrigin(configuredAppUrl)) {
    return configuredAppUrl;
  }

  const productionOrigin = getProductionPublicOrigin();

  if (rawHeaderHost || configuredAppUrl || isProductionRuntime()) {
    return productionOrigin;
  }

  const requestOrigin = new URL(request.url).origin;

  if (isVercelAppOrigin(requestOrigin)) {
    return productionOrigin;
  }

  return requestOrigin;
}

function isTrustedHost(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();

  if (isLocalHost(hostname)) return true;
  if (hostname === PRODUCTION_APP_HOSTNAME || hostname === "ieeevm.knurdz.org") return true;
  if (hostname.endsWith(".knurdz.org")) return true;
  if (isVercelAppOrigin(hostname)) return true;

  const configured = parseOrigin(process.env.APP_URL);
  if (configured && new URL(configured).hostname.toLowerCase() === hostname) return true;

  const appwriteHost = process.env.APPWRITE_PRODUCTION_HOSTNAME?.trim().toLowerCase();
  if (appwriteHost && appwriteHost === hostname) return true;

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().toLowerCase();
  if (vercelProd && vercelProd === hostname) return true;

  return false;
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
