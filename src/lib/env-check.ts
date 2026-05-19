/**
 * Environment variable validation for production readiness.
 * Checks required and optional variables at startup.
 */

export interface EnvCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  "JWT_SECRET",
  "APP_URL",
  "DATABASE_URL",
] as const;

const RECOMMENDED_VARS = [
  { key: "SMTP_HOST", feature: "email notifications" },
  { key: "SMTP_FROM", feature: "email sender address" },
  { key: "NEXT_PUBLIC_APP_URL", feature: "client-side URLs" },
] as const;

const OPTIONAL_FEATURE_VARS = [
  { key: "REDIS_URL", feature: "L2 cache (Redis)" },
  { key: "VAPID_PUBLIC_KEY", feature: "push notifications" },
  { key: "VAPID_PRIVATE_KEY", feature: "push notifications" },
  { key: "ANTHROPIC_API_KEY", feature: "AI features (Anthropic)" },
  { key: "SENTRY_DSN", feature: "error tracking (Sentry)" },
] as const;

export function checkEnvironment(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters");
  }

  // Validate APP_URL format
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
        warnings.push("APP_URL should use HTTPS in production");
      }
    } catch {
      errors.push("APP_URL is not a valid URL");
    }
  }

  // Check recommended variables
  for (const { key, feature } of RECOMMENDED_VARS) {
    if (!process.env[key]) {
      warnings.push(`Missing ${key} — ${feature} will be disabled`);
    }
  }

  // Check optional feature variables
  for (const { key, feature } of OPTIONAL_FEATURE_VARS) {
    if (!process.env[key]) {
      warnings.push(`Optional: ${key} not set — ${feature} disabled`);
    }
  }

  // Validate VAPID key pair completeness
  const hasVapidPub = !!process.env.VAPID_PUBLIC_KEY;
  const hasVapidPriv = !!process.env.VAPID_PRIVATE_KEY;
  if (hasVapidPub !== hasVapidPriv) {
    errors.push("Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getFeatureStatus(): Record<string, boolean> {
  return {
    email: !!(process.env.SMTP_HOST && process.env.SMTP_FROM),
    redis: !!process.env.REDIS_URL,
    pushNotifications: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    aiAnthropic: !!process.env.ANTHROPIC_API_KEY,
    sentry: !!process.env.SENTRY_DSN,
    postgresql: process.env.DATABASE_DRIVER === "postgresql",
  };
}
