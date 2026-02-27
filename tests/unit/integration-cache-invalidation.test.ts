import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB + Redis before cache module imports ────────────────────────

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ get: vi.fn().mockReturnValue(null) }) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ set: () => ({ run: vi.fn() }) }) }) }),
    delete: () => ({ where: () => ({ run: vi.fn() }), run: vi.fn() }),
    run: vi.fn(),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("@/db/schema", () => ({
  cacheEntries: { key: "key", value: "value", expiresAt: "expires_at" },
}));

vi.mock("@/lib/redis", () => ({
  getRedis: () => null,
  isRedisReady: () => false,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  cacheSet,
  cacheGet,
  cacheDelete,
  cacheClear,
  getCacheStats,
  resetCacheStats,
  getMemoryKeys,
} from "@/lib/cache";

import {
  tagCacheKey,
  invalidateTag,
  invalidateTags,
  getTagStats,
  clearTags,
} from "@/lib/cache/tags";

import {
  invalidateByPrefix,
} from "@/lib/cache/invalidate";

beforeEach(() => {
  vi.clearAllMocks();
  cacheClear();
  clearTags();
  resetCacheStats();
});

describe("Integration: Cache Invalidation Cascades", () => {
  describe("Tag-based invalidation", () => {
    it("should invalidate all entries for a tag", () => {
      cacheSet("project:1", "p1", 60);
      cacheSet("project:2", "p2", 60);
      cacheSet("vote:1", "v1", 60);

      tagCacheKey("project:1", ["projects"]);
      tagCacheKey("project:2", ["projects"]);
      tagCacheKey("vote:1", ["votes"]);

      invalidateTag("projects");

      expect(cacheGet("project:1")).toBeNull();
      expect(cacheGet("project:2")).toBeNull();
      expect(cacheGet("vote:1")).toBe("v1");
    });

    it("should invalidate entries with multiple tags", () => {
      cacheSet("dashboard:stats", "d1", 60);
      cacheSet("project:1", "p1", 60);

      tagCacheKey("dashboard:stats", ["dashboard", "projects"]);
      tagCacheKey("project:1", ["projects"]);

      invalidateTag("projects");

      expect(cacheGet("dashboard:stats")).toBeNull();
      expect(cacheGet("project:1")).toBeNull();
    });

    it("should not affect entries without the tag", () => {
      cacheSet("user:1", "u1", 60);
      tagCacheKey("user:1", ["users"]);
      invalidateTag("projects");
      expect(cacheGet("user:1")).toBe("u1");
    });

    it("should invalidate multiple tags at once", () => {
      cacheSet("p1", "p1", 60);
      cacheSet("v1", "v1", 60);
      tagCacheKey("p1", ["projects"]);
      tagCacheKey("v1", ["votes"]);

      invalidateTags(["projects", "votes"]);

      expect(cacheGet("p1")).toBeNull();
      expect(cacheGet("v1")).toBeNull();
    });
  });

  describe("Cascading invalidation scenarios", () => {
    it("should cascade: project update invalidates project-scoped caches", () => {
      cacheSet("project:1", "data", 60);
      cacheSet("project:1:proposals", "proposals", 60);
      cacheSet("project:1:votes", "votes", 60);
      cacheSet("project:2", "other", 60);

      tagCacheKey("project:1", ["project:1"]);
      tagCacheKey("project:1:proposals", ["project:1"]);
      tagCacheKey("project:1:votes", ["project:1"]);
      tagCacheKey("project:2", ["project:2"]);

      invalidateTag("project:1");

      expect(cacheGet("project:1")).toBeNull();
      expect(cacheGet("project:1:proposals")).toBeNull();
      expect(cacheGet("project:1:votes")).toBeNull();
      expect(cacheGet("project:2")).toBe("other");
    });

    it("should cascade: broad tag invalidates dashboard too", () => {
      cacheSet("project:1", "p1", 60);
      cacheSet("dashboard:overview", "d1", 60);

      tagCacheKey("project:1", ["projects"]);
      tagCacheKey("dashboard:overview", ["projects"]);

      invalidateTag("projects");

      expect(cacheGet("project:1")).toBeNull();
      expect(cacheGet("dashboard:overview")).toBeNull();
    });
  });

  describe("Prefix-based invalidation", () => {
    it("should invalidate all keys with matching prefix", () => {
      cacheSet("proposal:1", "a", 60);
      cacheSet("proposal:2", "b", 60);
      cacheSet("project:1", "c", 60);

      const count = invalidateByPrefix("proposal:");
      expect(count).toBeGreaterThanOrEqual(2);
      expect(cacheGet("proposal:1")).toBeNull();
      expect(cacheGet("proposal:2")).toBeNull();
      expect(cacheGet("project:1")).toBe("c");
    });
  });

  describe("Cache stats tracking", () => {
    it("should track hits and misses", () => {
      cacheSet("key1", "val1", 60);
      cacheGet("key1"); // hit
      cacheGet("missing"); // miss

      const stats = getCacheStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });

    it("should compute hit rate", () => {
      cacheSet("key1", "val1", 60);
      cacheGet("key1");
      cacheGet("key1");
      cacheGet("missing");

      const stats = getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it("should track memory entries", () => {
      cacheSet("a", "1", 60);
      cacheSet("b", "2", 60);
      const stats = getCacheStats();
      expect(stats.memEntries).toBeGreaterThanOrEqual(2);
    });

    it("should decrease after deletion", () => {
      cacheSet("del-test", "val", 60);
      const before = getCacheStats().memEntries;
      cacheDelete("del-test");
      const after = getCacheStats().memEntries;
      expect(after).toBeLessThan(before);
    });
  });

  describe("Tag stats tracking", () => {
    it("should report tag statistics", () => {
      cacheSet("a", "1", 60);
      tagCacheKey("a", ["tag1", "tag2"]);
      const stats = getTagStats();
      expect(stats.totalTags).toBeGreaterThanOrEqual(2);
      expect(stats.totalTrackedKeys).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Memory key listing", () => {
    it("should list all keys in memory", () => {
      cacheSet("key1", "val1", 60);
      cacheSet("key2", "val2", 60);
      const keys = getMemoryKeys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
    });
  });
});
