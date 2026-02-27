import { describe, it, expect } from "vitest";
import { TTL_TIERS, getTTLForEntity, getTTL } from "@/lib/cache/ttl";
import type { TTLTier } from "@/lib/cache/ttl";

describe("cache/ttl", () => {
  describe("TTL_TIERS", () => {
    it("defines all expected tiers", () => {
      expect(TTL_TIERS.static).toBe(3600);
      expect(TTL_TIERS.slow).toBe(600);
      expect(TTL_TIERS.moderate).toBe(300);
      expect(TTL_TIERS.fast).toBe(60);
      expect(TTL_TIERS.realtime).toBe(15);
    });

    it("has 5 tiers", () => {
      expect(Object.keys(TTL_TIERS)).toHaveLength(5);
    });
  });

  describe("getTTL", () => {
    it("returns correct value for each tier", () => {
      const tiers: TTLTier[] = ["static", "slow", "moderate", "fast", "realtime"];
      for (const tier of tiers) {
        expect(getTTL(tier)).toBe(TTL_TIERS[tier]);
      }
    });
  });

  describe("getTTLForEntity", () => {
    it("returns correct TTL for known entity types", () => {
      expect(getTTLForEntity("project")).toBe(600); // slow
      expect(getTTLForEntity("project:list")).toBe(300); // moderate
      expect(getTTLForEntity("proposal")).toBe(300); // moderate
      expect(getTTLForEntity("vote")).toBe(60); // fast
      expect(getTTLForEntity("vote:count")).toBe(60); // fast
      expect(getTTLForEntity("comment")).toBe(60); // fast
      expect(getTTLForEntity("dashboard")).toBe(300); // moderate
      expect(getTTLForEntity("user:profile")).toBe(600); // slow
      expect(getTTLForEntity("search:results")).toBe(60); // fast
      expect(getTTLForEntity("search:suggestions")).toBe(300); // moderate
      expect(getTTLForEntity("analytics")).toBe(600); // slow
      expect(getTTLForEntity("permission")).toBe(3600); // static
      expect(getTTLForEntity("workflow")).toBe(600); // slow
      expect(getTTLForEntity("ai:insight")).toBe(600); // slow
    });

    it("falls back to moderate (300s) for unknown entity types", () => {
      expect(getTTLForEntity("unknown")).toBe(300);
      expect(getTTLForEntity("foo:bar")).toBe(300);
      expect(getTTLForEntity("")).toBe(300);
    });
  });
});
