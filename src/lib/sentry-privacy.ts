import type { ErrorEvent } from "@sentry/core";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("email") ||
    normalized.includes("uomemail") ||
    normalized.includes("cookie") ||
    normalized.includes("authorization") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("api_key") ||
    normalized.includes("apikey") ||
    normalized.includes("appwrite-key") ||
    normalized.includes("appwrite_key") ||
    normalized === "body" ||
    normalized === "data" ||
    normalized === "request_body" ||
    normalized === "requestbody"
  );
}

function redactString(value: string) {
  return value.replace(EMAIL_PATTERN, "[email]");
}

function redactValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveKey(key)) {
    return "[Filtered]";
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
        nestedKey,
        redactValue(nestedValue, nestedKey),
      ]),
    );
  }

  return value;
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) {
    event.message = redactString(event.message);
  }

  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = redactString(exception.value);
      }
    }
  }

  if (event.request) {
    if (event.request.cookies) {
      event.request.cookies = {};
    }

    if (event.request.headers) {
      event.request.headers = Object.fromEntries(
        Object.entries(event.request.headers).map(([header, value]) => {
          const name = header.toLowerCase();
          if (
            name === "cookie" ||
            name === "authorization" ||
            name.includes("appwrite")
          ) {
            return [header, "[Filtered]"];
          }

          return [header, typeof value === "string" ? redactString(value) : value];
        }),
      );
    }

    if ("data" in event.request) {
      event.request.data = "[Filtered]";
    }

    if (typeof event.request.query_string === "string") {
      event.request.query_string = redactString(event.request.query_string);
    }

    if (event.request.url) {
      event.request.url = redactString(event.request.url);
    }
  }

  if (event.user) {
    event.user = {
      id: event.user.id,
    };
  }

  if (event.extra) {
    event.extra = redactValue(event.extra) as typeof event.extra;
  }

  if (event.contexts) {
    event.contexts = redactValue(event.contexts) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message ? redactString(breadcrumb.message) : breadcrumb.message,
      data: breadcrumb.data
        ? (redactValue(breadcrumb.data) as typeof breadcrumb.data)
        : breadcrumb.data,
    }));
  }

  return event;
}
