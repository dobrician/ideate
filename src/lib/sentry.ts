import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error in Sentry (no-op if Sentry is not configured).
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
