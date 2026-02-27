import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockWhere,
      }),
    }),
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    update: () => ({
      set: mockSet,
    }),
  },
}));

vi.mock("@/db/schema", () => ({ apiKeys: {} }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 99 })),
}));

import {
  generateApiKey,
  hashKey,
  validateScopes,
  TIER_CONFIGS,
  API_SCOPES,
  checkApiKeyRateLimit,
  type ApiKeyTier,
} from "@/lib/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([]);
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

describe("Integration: API Key Lifecycle", () => {
  describe("Key generation quality", () => {
    it("should generate keys with idk_ prefix", () => {
      const { raw } = generateApiKey();
      expect(raw.startsWith("idk_")).toBe(true);
    });

    it("should generate 32-byte random keys (64 hex chars + prefix)", () => {
      const { raw } = generateApiKey();
      expect(raw.length).toBe(68); // "idk_" + 64 hex chars
    });

    it("should generate unique keys on each call", () => {
      const keys = new Set(Array.from({ length: 50 }, () => generateApiKey().raw));
      expect(keys.size).toBe(50);
    });

    it("should produce SHA-256 hashes (64 hex chars)", () => {
      const { hash } = generateApiKey();
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it("should produce prefix of first 12 chars", () => {
      const { raw, prefix } = generateApiKey();
      expect(prefix).toBe(raw.slice(0, 12));
      expect(prefix.startsWith("idk_")).toBe(true);
    });
  });

  describe("Hash consistency", () => {
    it("should produce same hash for same key", () => {
      const key = "idk_test1234567890abcdef1234567890abcdef";
      expect(hashKey(key)).toBe(hashKey(key));
    });

    it("should produce different hashes for different keys", () => {
      expect(hashKey("idk_key1")).not.toBe(hashKey("idk_key2"));
    });

    it("should be deterministic across calls", () => {
      const hash1 = hashKey("idk_abcdef0123456789");
      const hash2 = hashKey("idk_abcdef0123456789");
      expect(hash1).toBe(hash2);
    });
  });

  describe("Tier configuration", () => {
    it("should have basic, pro, and enterprise tiers", () => {
      expect(TIER_CONFIGS.basic).toBeDefined();
      expect(TIER_CONFIGS.pro).toBeDefined();
      expect(TIER_CONFIGS.enterprise).toBeDefined();
    });

    it("should have increasing rate limits per tier", () => {
      expect(TIER_CONFIGS.basic.rateLimit).toBeLessThan(TIER_CONFIGS.pro.rateLimit);
      expect(TIER_CONFIGS.pro.rateLimit).toBeLessThan(TIER_CONFIGS.enterprise.rateLimit);
    });

    it("should have increasing max keys per tier", () => {
      expect(TIER_CONFIGS.basic.maxKeys).toBeLessThan(TIER_CONFIGS.pro.maxKeys);
      expect(TIER_CONFIGS.pro.maxKeys).toBeLessThan(TIER_CONFIGS.enterprise.maxKeys);
    });

    it("should use 1-hour rate limit windows", () => {
      for (const tier of Object.values(TIER_CONFIGS)) {
        expect(tier.rateLimitWindow).toBe(3600);
      }
    });
  });

  describe("Scope validation", () => {
    it("should accept all valid scopes", () => {
      expect(validateScopes([...API_SCOPES])).toBe(true);
    });

    it("should accept empty scopes", () => {
      expect(validateScopes([])).toBe(true);
    });

    it("should reject unknown scopes", () => {
      expect(validateScopes(["invalid:scope"])).toBe(false);
      expect(validateScopes(["admin:delete"])).toBe(false);
    });

    it("should reject partial valid scopes", () => {
      expect(validateScopes(["read:projects", "invalid"])).toBe(false);
    });

    it("should define all expected scope names", () => {
      expect(API_SCOPES).toContain("read:projects");
      expect(API_SCOPES).toContain("write:projects");
      expect(API_SCOPES).toContain("read:proposals");
      expect(API_SCOPES).toContain("read:analytics");
      expect(API_SCOPES).toContain("webhooks:manage");
    });
  });

  describe("Rate limiting integration", () => {
    it("should create per-key rate limit keys", () => {
      checkApiKeyRateLimit("key-123", 100, 3600);
      expect(checkRateLimit).toHaveBeenCalledWith("apikey:key-123", 100, 3600000);
    });

    it("should use tier-specific limits", () => {
      const tiers: ApiKeyTier[] = ["basic", "pro", "enterprise"];
      for (const tier of tiers) {
        const config = TIER_CONFIGS[tier];
        checkApiKeyRateLimit(`key-${tier}`, config.rateLimit, config.rateLimitWindow);
        expect(checkRateLimit).toHaveBeenCalledWith(
          `apikey:key-${tier}`,
          config.rateLimit,
          config.rateLimitWindow * 1000,
        );
      }
    });
  });
});
