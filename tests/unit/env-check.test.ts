import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { checkEnvironment, getFeatureStatus } from "@/lib/env-check";

describe("Environment Check", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("checkEnvironment", () => {
    it("should report errors for missing required vars", () => {
      delete process.env.JWT_SECRET;
      delete process.env.APP_URL;
      delete process.env.DATABASE_URL;

      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required env var: JWT_SECRET");
      expect(result.errors).toContain("Missing required env var: APP_URL");
      expect(result.errors).toContain("Missing required env var: DATABASE_URL");
    });

    it("should pass when all required vars are set", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";

      const result = checkEnvironment();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject JWT_SECRET shorter than 32 characters", () => {
      process.env.JWT_SECRET = "short";
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";

      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("JWT_SECRET must be at least 32 characters");
    });

    it("should accept JWT_SECRET of exactly 32 characters", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";

      const result = checkEnvironment();
      const jwtErrors = result.errors.filter((e) => e.includes("JWT_SECRET"));
      expect(jwtErrors).toHaveLength(0);
    });

    it("should reject invalid APP_URL", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "not-a-url";
      process.env.DATABASE_URL = "/data/test.sqlite";

      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("APP_URL is not a valid URL");
    });

    it("should warn about HTTP APP_URL in production", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "http://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      process.env.NODE_ENV = "production";

      const result = checkEnvironment();
      expect(result.warnings).toContain("APP_URL should use HTTPS in production");
    });

    it("should not warn about HTTP APP_URL in development", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "http://localhost:3000";
      process.env.DATABASE_URL = "/data/test.sqlite";
      process.env.NODE_ENV = "development";

      const result = checkEnvironment();
      const httpsWarnings = result.warnings.filter((w) => w.includes("HTTPS"));
      expect(httpsWarnings).toHaveLength(0);
    });

    it("should warn about missing recommended vars", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_FROM;

      const result = checkEnvironment();
      expect(result.warnings.some((w) => w.includes("SMTP_HOST"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("SMTP_FROM"))).toBe(true);
    });

    it("should warn about missing optional vars", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      delete process.env.REDIS_URL;

      const result = checkEnvironment();
      expect(result.warnings.some((w) => w.includes("REDIS_URL"))).toBe(true);
    });

    it("should error when only one VAPID key is set", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      process.env.VAPID_PUBLIC_KEY = "test-pub-key";
      delete process.env.VAPID_PRIVATE_KEY;

      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together",
      );
    });

    it("should pass when both VAPID keys are set", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      process.env.VAPID_PUBLIC_KEY = "test-pub-key";
      process.env.VAPID_PRIVATE_KEY = "test-priv-key";

      const result = checkEnvironment();
      const vapidErrors = result.errors.filter((e) => e.includes("VAPID"));
      expect(vapidErrors).toHaveLength(0);
    });

    it("should pass when neither VAPID key is set", () => {
      process.env.JWT_SECRET = "a".repeat(32);
      process.env.APP_URL = "https://example.com";
      process.env.DATABASE_URL = "/data/test.sqlite";
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      const result = checkEnvironment();
      const vapidErrors = result.errors.filter((e) => e.includes("VAPID"));
      expect(vapidErrors).toHaveLength(0);
    });
  });

  describe("getFeatureStatus", () => {
    it("should report email enabled when SMTP vars are set", () => {
      process.env.SMTP_HOST = "smtp.test.com";
      process.env.SMTP_FROM = "test@test.com";

      const features = getFeatureStatus();
      expect(features.email).toBe(true);
    });

    it("should report email disabled when SMTP vars are missing", () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_FROM;

      const features = getFeatureStatus();
      expect(features.email).toBe(false);
    });

    it("should report redis enabled when REDIS_URL is set", () => {
      process.env.REDIS_URL = "redis://localhost:6379";

      const features = getFeatureStatus();
      expect(features.redis).toBe(true);
    });

    it("should report push notifications enabled when both VAPID keys set", () => {
      process.env.VAPID_PUBLIC_KEY = "pub-key";
      process.env.VAPID_PRIVATE_KEY = "priv-key";

      const features = getFeatureStatus();
      expect(features.pushNotifications).toBe(true);
    });

    it("should report push notifications disabled when VAPID keys missing", () => {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      const features = getFeatureStatus();
      expect(features.pushNotifications).toBe(false);
    });

    it("should report Anthropic enabled when ANTHROPIC_API_KEY is set", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";

      const features = getFeatureStatus();
      expect(features.aiAnthropic).toBe(true);
    });

    it("should report Anthropic disabled when ANTHROPIC_API_KEY is missing", () => {
      delete process.env.ANTHROPIC_API_KEY;

      const features = getFeatureStatus();
      expect(features.aiAnthropic).toBe(false);
    });

    it("should report sentry enabled when DSN is set", () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";

      const features = getFeatureStatus();
      expect(features.sentry).toBe(true);
    });

    it("should report postgresql mode based on DATABASE_DRIVER", () => {
      process.env.DATABASE_DRIVER = "postgresql";

      const features = getFeatureStatus();
      expect(features.postgresql).toBe(true);
    });

    it("should default to non-postgresql when DATABASE_DRIVER not set", () => {
      delete process.env.DATABASE_DRIVER;

      const features = getFeatureStatus();
      expect(features.postgresql).toBe(false);
    });
  });
});
