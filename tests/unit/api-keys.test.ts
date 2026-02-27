import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockInsert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => []) })) }));
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(() => []),
    })),
  })),
}));
const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({})) })) }));

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99, retryAfterMs: 0 })),
}));

import {
  generateApiKey,
  hashKey,
  validateScopes,
  API_SCOPES,
  TIER_CONFIGS,
  checkApiKeyRateLimit,
  type ApiKeyTier,
} from "@/lib/api-keys";

describe("API Keys", () => {
  describe("generateApiKey", () => {
    it("should generate a key with idk_ prefix", () => {
      const { raw } = generateApiKey();
      expect(raw.startsWith("idk_")).toBe(true);
    });

    it("should return raw key, hash, and prefix", () => {
      const result = generateApiKey();
      expect(result.raw).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.prefix).toBeDefined();
    });

    it("should generate unique keys", () => {
      const k1 = generateApiKey();
      const k2 = generateApiKey();
      expect(k1.raw).not.toBe(k2.raw);
      expect(k1.hash).not.toBe(k2.hash);
    });

    it("should produce prefix of 12 chars", () => {
      const { prefix } = generateApiKey();
      expect(prefix.length).toBe(12);
    });

    it("should produce consistent hash from raw key", () => {
      const { raw, hash } = generateApiKey();
      expect(hashKey(raw)).toBe(hash);
    });
  });

  describe("hashKey", () => {
    it("should produce consistent hashes", () => {
      expect(hashKey("test-key")).toBe(hashKey("test-key"));
    });

    it("should produce different hashes for different keys", () => {
      expect(hashKey("key1")).not.toBe(hashKey("key2"));
    });

    it("should return hex string", () => {
      const hash = hashKey("test");
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("validateScopes", () => {
    it("should validate correct scopes", () => {
      expect(validateScopes(["read:projects", "read:proposals"])).toBe(true);
    });

    it("should reject invalid scopes", () => {
      expect(validateScopes(["invalid:scope"])).toBe(false);
    });

    it("should accept empty array", () => {
      expect(validateScopes([])).toBe(true);
    });

    it("should reject mixed valid/invalid scopes", () => {
      expect(validateScopes(["read:projects", "write:everything"])).toBe(false);
    });

    it("should accept all defined scopes", () => {
      expect(validateScopes([...API_SCOPES])).toBe(true);
    });
  });

  describe("API_SCOPES", () => {
    it("should define expected scopes", () => {
      expect(API_SCOPES).toContain("read:projects");
      expect(API_SCOPES).toContain("write:projects");
      expect(API_SCOPES).toContain("read:proposals");
      expect(API_SCOPES).toContain("write:proposals");
      expect(API_SCOPES).toContain("read:votes");
      expect(API_SCOPES).toContain("read:users");
      expect(API_SCOPES).toContain("read:analytics");
      expect(API_SCOPES).toContain("webhooks:manage");
    });

    it("should have 8 scopes", () => {
      expect(API_SCOPES).toHaveLength(8);
    });
  });

  describe("TIER_CONFIGS", () => {
    it("should define basic tier", () => {
      expect(TIER_CONFIGS.basic.rateLimit).toBe(100);
      expect(TIER_CONFIGS.basic.rateLimitWindow).toBe(3600);
      expect(TIER_CONFIGS.basic.maxKeys).toBe(3);
    });

    it("should define pro tier with higher limits", () => {
      expect(TIER_CONFIGS.pro.rateLimit).toBe(1000);
      expect(TIER_CONFIGS.pro.maxKeys).toBe(10);
    });

    it("should define enterprise tier with highest limits", () => {
      expect(TIER_CONFIGS.enterprise.rateLimit).toBe(10000);
      expect(TIER_CONFIGS.enterprise.maxKeys).toBe(50);
    });

    it("should have progressive rate limits", () => {
      expect(TIER_CONFIGS.basic.rateLimit).toBeLessThan(TIER_CONFIGS.pro.rateLimit);
      expect(TIER_CONFIGS.pro.rateLimit).toBeLessThan(TIER_CONFIGS.enterprise.rateLimit);
    });
  });

  describe("checkApiKeyRateLimit", () => {
    it("should return a rate limit result", () => {
      const result = checkApiKeyRateLimit("key-123", 100, 3600);
      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("retryAfterMs");
      expect(result.allowed).toBe(true);
    });
  });
});
