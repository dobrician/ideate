import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  tagCacheKey,
  invalidateTag,
  invalidateTags,
  removeKeyFromTags,
  getTagStats,
  clearTags,
} from "@/lib/cache/tags";

// Mock the cache module
vi.mock("@/lib/cache", () => ({
  cacheDelete: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { cacheDelete } from "@/lib/cache";

describe("cache/tags", () => {
  beforeEach(() => {
    clearTags();
    vi.clearAllMocks();
  });

  describe("tagCacheKey", () => {
    it("associates a key with tags", () => {
      tagCacheKey("project:1", ["project", "entity"]);
      const stats = getTagStats();
      expect(stats.totalTags).toBe(2);
      expect(stats.totalTrackedKeys).toBe(1);
    });

    it("handles empty tags array gracefully", () => {
      tagCacheKey("project:1", []);
      expect(getTagStats().totalTrackedKeys).toBe(0);
    });

    it("accumulates tags for the same key", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("project:1", ["entity"]);
      expect(getTagStats().totalTags).toBe(2);
      expect(getTagStats().totalTrackedKeys).toBe(1);
    });

    it("tracks multiple keys under the same tag", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("project:2", ["project"]);
      expect(getTagStats().totalTags).toBe(1);
      expect(getTagStats().totalTrackedKeys).toBe(2);
    });
  });

  describe("invalidateTag", () => {
    it("deletes all keys associated with a tag", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("project:2", ["project"]);
      tagCacheKey("proposal:1", ["proposal"]);

      const count = invalidateTag("project");
      expect(count).toBe(2);
      expect(cacheDelete).toHaveBeenCalledWith("project:1");
      expect(cacheDelete).toHaveBeenCalledWith("project:2");
      expect(cacheDelete).not.toHaveBeenCalledWith("proposal:1");
    });

    it("returns 0 for non-existent tag", () => {
      expect(invalidateTag("nonexistent")).toBe(0);
    });

    it("cleans up tag index after invalidation", () => {
      tagCacheKey("project:1", ["project"]);
      invalidateTag("project");
      expect(getTagStats().totalTags).toBe(0);
    });

    it("removes tag from key when key has multiple tags", () => {
      tagCacheKey("project:1", ["project", "entity"]);
      invalidateTag("project");
      // Key still tracked under "entity" tag
      expect(getTagStats().totalTags).toBe(1);
      expect(getTagStats().totalTrackedKeys).toBe(1);
    });
  });

  describe("invalidateTags", () => {
    it("invalidates multiple tags at once", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("proposal:1", ["proposal"]);
      tagCacheKey("vote:1", ["vote"]);

      const count = invalidateTags(["project", "proposal"]);
      expect(count).toBe(2);
      expect(cacheDelete).toHaveBeenCalledWith("project:1");
      expect(cacheDelete).toHaveBeenCalledWith("proposal:1");
    });

    it("handles empty array", () => {
      expect(invalidateTags([])).toBe(0);
    });
  });

  describe("removeKeyFromTags", () => {
    it("removes a key from all its tag associations", () => {
      tagCacheKey("project:1", ["project", "entity"]);
      removeKeyFromTags("project:1");
      expect(getTagStats().totalTrackedKeys).toBe(0);
      expect(getTagStats().totalTags).toBe(0);
    });

    it("does not affect other keys under same tag", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("project:2", ["project"]);
      removeKeyFromTags("project:1");
      expect(getTagStats().totalTrackedKeys).toBe(1);
      expect(getTagStats().totalTags).toBe(1);
    });

    it("handles non-existent key gracefully", () => {
      removeKeyFromTags("nonexistent");
      expect(getTagStats().totalTrackedKeys).toBe(0);
    });
  });

  describe("getTagStats", () => {
    it("returns zeroes when empty", () => {
      expect(getTagStats()).toEqual({ totalTags: 0, totalTrackedKeys: 0 });
    });
  });

  describe("clearTags", () => {
    it("removes all tag associations", () => {
      tagCacheKey("project:1", ["project"]);
      tagCacheKey("proposal:1", ["proposal"]);
      clearTags();
      expect(getTagStats()).toEqual({ totalTags: 0, totalTrackedKeys: 0 });
    });
  });
});
