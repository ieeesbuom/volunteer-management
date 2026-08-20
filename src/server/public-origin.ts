import "server-only";

/**
 * Resolve the public app origin for OAuth redirects behind reverse proxies.
 * Prefers APP_URL, then forwarded headers, then the request URL.
 */
export function getPublicAppOrigin(request: Request): string {
  const configuredUrl = process.env.APP_URL?.trim();

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();

  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol =
      forwardedProto ||
      (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}
