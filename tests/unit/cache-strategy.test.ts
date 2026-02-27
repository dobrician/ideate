import { describe, it, expect } from "vitest";
import {
  CACHE_VERSION,
  CACHE_STRATEGIES,
  getCacheStrategy,
} from "@/lib/offline/cache-strategy";

describe("Cache Strategy", () => {
  it("should export a versioned cache name", () => {
    expect(CACHE_VERSION).toBe("ideate-v2");
  });

  it("should define cache strategies for all resource types", () => {
    expect(CACHE_STRATEGIES.length).toBeGreaterThan(0);
    const strategies = CACHE_STRATEGIES.map((s) => s.strategy);
    expect(strategies).toContain("cache-first");
    expect(strategies).toContain("network-first");
    expect(strategies).toContain("stale-while-revalidate");
    expect(strategies).toContain("network-only");
  });

  describe("getCacheStrategy", () => {
    it("should return cache-first for static assets", () => {
      const rule = getCacheStrategy("/_next/static/chunks/main.js");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("cache-first");
      expect(rule!.maxAge).toBe(365 * 24 * 3600);
    });

    it("should return cache-first for icons", () => {
      const rule = getCacheStrategy("/icons/icon-192.png");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("cache-first");
    });

    it("should return cache-first for fonts", () => {
      const rule = getCacheStrategy("/fonts/inter.woff2");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("cache-first");
    });

    it("should return network-first for API project data", () => {
      const rule = getCacheStrategy("/api/projects/123");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("network-first");
      expect(rule!.maxAge).toBe(300);
    });

    it("should return network-first for API proposals", () => {
      const rule = getCacheStrategy("/api/proposals");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("network-first");
    });

    it("should return network-first for API votes", () => {
      const rule = getCacheStrategy("/api/votes");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("network-first");
    });

    it("should return network-only for search API", () => {
      const rule = getCacheStrategy("/api/search/suggest");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("network-only");
    });

    it("should return stale-while-revalidate for page navigation", () => {
      const rule = getCacheStrategy("/projects");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("stale-while-revalidate");
    });

    it("should return stale-while-revalidate for root", () => {
      const rule = getCacheStrategy("/");
      expect(rule).not.toBeNull();
      expect(rule!.strategy).toBe("stale-while-revalidate");
    });

    it("should return null for unmatched paths", () => {
      const rule = getCacheStrategy("/api/admin/settings");
      expect(rule).toBeNull();
    });

    it("should have unique cache names per strategy group", () => {
      const cacheNames = new Set(CACHE_STRATEGIES.map((s) => s.cacheName));
      expect(cacheNames.size).toBeGreaterThan(1);
    });

    it("should prefix all cache names with version", () => {
      for (const rule of CACHE_STRATEGIES) {
        expect(rule.cacheName).toContain(CACHE_VERSION);
      }
    });
  });
});
