import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockSelectAll = vi.fn();
const mockDeleteRun = vi.fn();
const mockInsertRun = vi.fn();
const mockDeleteWhere = vi.fn().mockReturnValue({ run: () => mockDeleteRun() });
const mockOnConflict = vi.fn().mockReturnValue({ run: () => mockInsertRun() });
const mockInsertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => ({ all: () => mockSelectAll() }) }),
      }),
    }),
    insert: () => ({ values: mockInsertValues }),
    delete: () => ({ where: mockDeleteWhere, run: mockDeleteRun }),
  },
}));

vi.mock("@/db/schema", () => ({ cacheEntries: { key: Symbol("key") } }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Redis mocks — default: Redis not available
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
let mockRedisReady = false;

vi.mock("@/lib/redis", () => ({
  getRedis: () =>
    mockRedisReady
      ? { get: mockRedisGet, set: mockRedisSet, del: mockRedisDel }
      : null,
  isRedisReady: () => mockRedisReady,
}));

import {
  cacheGet,
  cacheGetAsync,
  cacheSet,
  cacheDelete,
  cacheClear,
  getCacheStats,
  resetCacheStats,
} from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisReady = false;
  cacheClear();
  resetCacheStats();
});

describe("Multi-layer Cache", () => {
  describe("cacheGet (sync)", () => {
    it("returns null on cache miss", () => {
      mockSelectAll.mockReturnValue([]);
      const result = cacheGet("nonexistent");
      expect(result).toBeNull();
    });

    it("returns value from memory layer (L1)", () => {
      mockSelectAll.mockReturnValue([]);
      cacheSet("test-key", "test-value", 60);
      mockSelectAll.mockClear();

      const result = cacheGet("test-key");
      expect(result).toBe("test-value");
      expect(mockSelectAll).not.toHaveBeenCalled();
    });

    it("returns value from DB layer (L3) and promotes to memory", () => {
      const now = Math.floor(Date.now() / 1000);
      mockSelectAll.mockReturnValue([{ value: "db-value", ttl: 300, createdAt: now }]);

      const result = cacheGet("db-key");
      expect(result).toBe("db-value");

      mockSelectAll.mockClear();
      const result2 = cacheGet("db-key");
      expect(result2).toBe("db-value");
      expect(mockSelectAll).not.toHaveBeenCalled();
    });

    it("returns null for expired DB entries", () => {
      const expired = Math.floor(Date.now() / 1000) - 600;
      mockSelectAll.mockReturnValue([{ value: "old-value", ttl: 300, createdAt: expired }]);

      const result = cacheGet("expired-key");
      expect(result).toBeNull();
    });

    it("tracks cache hits and misses", () => {
      mockSelectAll.mockReturnValue([]);
      cacheGet("miss1");
      cacheGet("miss2");

      cacheSet("hit-key", "value", 60);
      cacheGet("hit-key");

      const stats = getCacheStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(33);
    });
  });

  describe("cacheGetAsync", () => {
    it("returns value from memory (L1) without checking Redis", async () => {
      cacheSet("mem-key", "mem-value", 60);
      mockRedisReady = true;

      const result = await cacheGetAsync("mem-key");
      expect(result).toBe("mem-value");
      expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it("returns value from Redis (L2) when available", async () => {
      mockRedisReady = true;
      mockRedisGet.mockResolvedValue("redis-value");
      mockSelectAll.mockReturnValue([]);

      const result = await cacheGetAsync("redis-key");
      expect(result).toBe("redis-value");
      expect(mockRedisGet).toHaveBeenCalledWith("cache:redis-key");

      const stats = getCacheStats();
      expect(stats.redisHits).toBe(1);
    });

    it("falls through to DB (L3) on Redis miss", async () => {
      mockRedisReady = true;
      mockRedisGet.mockResolvedValue(null);
      const now = Math.floor(Date.now() / 1000);
      mockSelectAll.mockReturnValue([{ value: "db-val", ttl: 300, createdAt: now }]);

      const result = await cacheGetAsync("db-only");
      expect(result).toBe("db-val");

      const stats = getCacheStats();
      expect(stats.redisMisses).toBe(1);
      expect(stats.hits).toBe(1);
    });

    it("returns null when all layers miss", async () => {
      mockRedisReady = true;
      mockRedisGet.mockResolvedValue(null);
      mockSelectAll.mockReturnValue([]);

      const result = await cacheGetAsync("nowhere");
      expect(result).toBeNull();

      const stats = getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.redisMisses).toBe(1);
    });

    it("skips Redis when not ready", async () => {
      mockRedisReady = false;
      mockSelectAll.mockReturnValue([]);

      const result = await cacheGetAsync("no-redis");
      expect(result).toBeNull();
      expect(mockRedisGet).not.toHaveBeenCalled();
    });
  });

  describe("cacheSet", () => {
    it("stores value in memory and DB", () => {
      cacheSet("new-key", "new-value", 120);
      expect(mockInsertValues).toHaveBeenCalled();

      const result = cacheGet("new-key");
      expect(result).toBe("new-value");
    });

    it("writes to Redis when available", () => {
      mockRedisReady = true;
      cacheSet("redis-write", "val", 60);
      // Redis set is fire-and-forget (void promise)
      expect(mockRedisSet).toHaveBeenCalledWith("cache:redis-write", "val", "EX", 60);
    });

    it("evicts oldest entry when memory is full", () => {
      for (let i = 0; i < 501; i++) {
        cacheSet(`key-${i}`, `value-${i}`, 3600);
      }
      mockSelectAll.mockReturnValue([]);
      const result = cacheGet("key-0");
      expect(result).toBeNull();
    });
  });

  describe("cacheDelete", () => {
    it("removes value from all layers", () => {
      cacheSet("del-key", "del-value", 60);
      cacheDelete("del-key");

      mockSelectAll.mockReturnValue([]);
      const result = cacheGet("del-key");
      expect(result).toBeNull();
    });

    it("deletes from Redis when available", () => {
      mockRedisReady = true;
      cacheDelete("redis-del");
      expect(mockRedisDel).toHaveBeenCalledWith("cache:redis-del");
    });
  });

  describe("getCacheStats", () => {
    it("returns zero hit rate when no requests", () => {
      const stats = getCacheStats();
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("reports memory entry count", () => {
      cacheSet("a", "1", 60);
      cacheSet("b", "2", 60);
      const stats = getCacheStats();
      expect(stats.memEntries).toBe(2);
    });

    it("includes Redis stats", () => {
      const stats = getCacheStats();
      expect(stats.redisHits).toBe(0);
      expect(stats.redisMisses).toBe(0);
      expect(stats.redisEnabled).toBe(false);
    });

    it("reports redisEnabled when Redis is ready", () => {
      mockRedisReady = true;
      const stats = getCacheStats();
      expect(stats.redisEnabled).toBe(true);
    });
  });

  describe("resetCacheStats", () => {
    it("resets all counters including Redis", () => {
      mockSelectAll.mockReturnValue([]);
      cacheGet("miss");
      resetCacheStats();
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.redisHits).toBe(0);
      expect(stats.redisMisses).toBe(0);
    });
  });
});
