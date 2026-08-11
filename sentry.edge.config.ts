import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./src/lib/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: scrubSentryEvent,
});
