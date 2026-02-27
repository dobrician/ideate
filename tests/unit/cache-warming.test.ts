import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerWarmer,
  warmCache,
  warmKey,
  getRegisteredWarmers,
  clearWarmers,
} from "@/lib/cache/warming";

vi.mock("@/lib/cache", () => ({
  cacheSet: vi.fn(),
}));

vi.mock("@/lib/cache/tags", () => ({
  tagCacheKey: vi.fn(),
}));

vi.mock("@/lib/cache/ttl", () => ({
  getTTLForEntity: vi.fn(() => 300),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { cacheSet } from "@/lib/cache";
import { tagCacheKey } from "@/lib/cache/tags";

describe("cache/warming", () => {
  beforeEach(() => {
    clearWarmers();
    vi.clearAllMocks();
  });

  describe("registerWarmer", () => {
    it("registers a warmer function", () => {
      registerWarmer("project:list", async () => "[]");
      expect(getRegisteredWarmers()).toEqual(["project:list"]);
    });

    it("overwrites existing warmer for same key", () => {
      registerWarmer("project:list", async () => "v1");
      registerWarmer("project:list", async () => "v2");
      expect(getRegisteredWarmers()).toHaveLength(1);
    });
  });

  describe("warmCache", () => {
    it("runs all registered warmers and caches results", async () => {
      registerWarmer("project:list", async () => '["p1"]');
      registerWarmer("dashboard:stats", async () => '{"count":5}');

      const result = await warmCache();
      expect(result.total).toBe(2);
      expect(result.warmed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(cacheSet).toHaveBeenCalledTimes(2);
      expect(tagCacheKey).toHaveBeenCalledTimes(2);
    });

    it("skips warmers that return null", async () => {
      registerWarmer("project:empty", async () => null);

      const result = await warmCache();
      expect(result.total).toBe(1);
      expect(result.warmed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(cacheSet).not.toHaveBeenCalled();
    });

    it("handles warmer errors gracefully", async () => {
      registerWarmer("project:fail", async () => {
        throw new Error("DB down");
      });
      registerWarmer("project:ok", async () => '{"ok":true}');

      const result = await warmCache();
      expect(result.warmed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("DB down");
    });

    it("returns empty result when no warmers registered", async () => {
      const result = await warmCache();
      expect(result.total).toBe(0);
      expect(result.warmed).toBe(0);
    });
  });

  describe("warmKey", () => {
    it("warms a specific registered key", async () => {
      registerWarmer("project:list", async () => '["p1"]');

      const success = await warmKey("project:list");
      expect(success).toBe(true);
      expect(cacheSet).toHaveBeenCalledTimes(1);
    });

    it("returns false for unregistered key", async () => {
      const success = await warmKey("unknown:key");
      expect(success).toBe(false);
    });

    it("returns false when warmer returns null", async () => {
      registerWarmer("project:empty", async () => null);

      const success = await warmKey("project:empty");
      expect(success).toBe(false);
    });

    it("returns false when warmer throws", async () => {
      registerWarmer("project:fail", async () => {
        throw new Error("fail");
      });

      const success = await warmKey("project:fail");
      expect(success).toBe(false);
    });
  });

  describe("getRegisteredWarmers", () => {
    it("returns empty array when none registered", () => {
      expect(getRegisteredWarmers()).toEqual([]);
    });

    it("returns all registered keys", () => {
      registerWarmer("a", async () => "1");
      registerWarmer("b", async () => "2");
      expect(getRegisteredWarmers()).toEqual(["a", "b"]);
    });
  });

  describe("clearWarmers", () => {
    it("removes all registered warmers", () => {
      registerWarmer("a", async () => "1");
      clearWarmers();
      expect(getRegisteredWarmers()).toEqual([]);
    });
  });
});
