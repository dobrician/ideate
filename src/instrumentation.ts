export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (...args: unknown[]) => {
  // Only import Sentry if DSN is configured
  if (!process.env.SENTRY_DSN) return;

  const { captureRequestError } = await import("@sentry/nextjs");
  // @ts-expect-error — Sentry's onRequestError signature matches Next.js
  return captureRequestError(...args);
};
