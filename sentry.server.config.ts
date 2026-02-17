import * as Sentry from "@sentry/nextjs";

// Sentry is optional — silently disabled when SENTRY_DSN is not set
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    debug: false,
  });
}
