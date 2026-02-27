import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheGet = vi.fn<(key: string) => string | null>(() => null);
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();
const mockTagCacheKey = vi.fn();
const mockGetTTLForEntity = vi.fn(() => 300);

vi.mock("@/lib/cache", () => ({
  cacheGet: (key: string) => mockCacheGet(key),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
}));

vi.mock("@/lib/cache/tags", () => ({
  tagCacheKey: (...args: unknown[]) => mockTagCacheKey(...args),
}));

vi.mock("@/lib/cache/ttl", () => ({
  getTTLForEntity: (t: string) => mockGetTTLForEntity(t),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { cachedQuery, cachedQueryAsync } from "@/lib/cache/query";

describe("cache/query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockReturnValue(null);
    mockGetTTLForEntity.mockReturnValue(300);
  });

  describe("cachedQuery", () => {
    it("returns cached result on hit", () => {
      mockCacheGet.mockReturnValue('{"id":"1","title":"Test"}');

      const result = cachedQuery("project:1", "project", () => ({ id: "2", title: "Fresh" }));
      expect(result).toEqual({ id: "1", title: "Test" });
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it("executes query and caches on miss", () => {
      const queryFn = vi.fn(() => ({ id: "1", title: "Test" }));

      const result = cachedQuery("project:1", "project", queryFn);
      expect(result).toEqual({ id: "1", title: "Test" });
      expect(queryFn).toHaveBeenCalledOnce();
      expect(mockCacheSet).toHaveBeenCalledWith("project:1", '{"id":"1","title":"Test"}', 300);
    });

    it("uses entity-specific TTL", () => {
      mockGetTTLForEntity.mockReturnValue(60);

      cachedQuery("vote:1", "vote", () => ({ value: 1 }));
      expect(mockCacheSet).toHaveBeenCalledWith("vote:1", '{"value":1}', 60);
      expect(mockGetTTLForEntity).toHaveBeenCalledWith("vote");
    });

    it("tags cache key when tags provided", () => {
      cachedQuery("project:1", "project", () => ({}), ["project", "entity"]);
      expect(mockTagCacheKey).toHaveBeenCalledWith("project:1", ["project", "entity"]);
    });

    it("does not tag when tags not provided", () => {
      cachedQuery("project:1", "project", () => ({}));
      expect(mockTagCacheKey).not.toHaveBeenCalled();
    });

    it("does not tag when empty tags array provided", () => {
      cachedQuery("project:1", "project", () => ({}), []);
      expect(mockTagCacheKey).not.toHaveBeenCalled();
    });

    it("deletes corrupted cache entries and re-queries", () => {
      mockCacheGet.mockReturnValue("not-valid-json{{{");

      const result = cachedQuery("project:1", "project", () => ({ id: "1" }));
      expect(result).toEqual({ id: "1" });
      expect(mockCacheDelete).toHaveBeenCalledWith("project:1");
    });
  });

  describe("cachedQueryAsync", () => {
    it("returns cached result on hit", async () => {
      mockCacheGet.mockReturnValue('["a","b"]');

      const result = await cachedQueryAsync("list:1", "project:list", async () => ["c"]);
      expect(result).toEqual(["a", "b"]);
    });

    it("executes async query and caches on miss", async () => {
      const queryFn = vi.fn(async () => [{ id: "1" }]);

      const result = await cachedQueryAsync("list:1", "project:list", queryFn);
      expect(result).toEqual([{ id: "1" }]);
      expect(queryFn).toHaveBeenCalledOnce();
      expect(mockCacheSet).toHaveBeenCalledWith("list:1", '[{"id":"1"}]', 300);
    });

    it("handles async query errors by propagating", async () => {
      const queryFn = async () => {
        throw new Error("DB error");
      };

      await expect(cachedQueryAsync("list:1", "project:list", queryFn)).rejects.toThrow("DB error");
    });

    it("deletes corrupted cache and re-queries", async () => {
      mockCacheGet.mockReturnValue("{{bad json");

      const result = await cachedQueryAsync("list:1", "project:list", async () => []);
      expect(result).toEqual([]);
      expect(mockCacheDelete).toHaveBeenCalledWith("list:1");
    });

    it("tags async results when tags provided", async () => {
      await cachedQueryAsync("list:1", "project:list", async () => [], ["list"]);
      expect(mockTagCacheKey).toHaveBeenCalledWith("list:1", ["list"]);
    });
  });
});
