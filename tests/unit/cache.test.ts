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

import { cacheGet, cacheSet, cacheDelete, cacheClear, getCacheStats, resetCacheStats } from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  cacheClear();
  resetCacheStats();
});

describe("Multi-layer Cache", () => {
  describe("cacheGet", () => {
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
      // Should not hit DB since memory has it
      expect(mockSelectAll).not.toHaveBeenCalled();
    });

    it("returns value from DB layer (L2) and promotes to memory", () => {
      const now = Math.floor(Date.now() / 1000);
      mockSelectAll.mockReturnValue([{ value: "db-value", ttl: 300, createdAt: now }]);

      const result = cacheGet("db-key");
      expect(result).toBe("db-value");

      // Second call should use memory
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

  describe("cacheSet", () => {
    it("stores value in memory and DB", () => {
      cacheSet("new-key", "new-value", 120);
      expect(mockInsertValues).toHaveBeenCalled();

      // Should be retrievable from memory
      const result = cacheGet("new-key");
      expect(result).toBe("new-value");
    });

    it("evicts oldest entry when memory is full", () => {
      // Fill memory to capacity
      for (let i = 0; i < 501; i++) {
        cacheSet(`key-${i}`, `value-${i}`, 3600);
      }
      // First key should be evicted
      mockSelectAll.mockReturnValue([]);
      const result = cacheGet("key-0");
      expect(result).toBeNull();
    });
  });

  describe("cacheDelete", () => {
    it("removes value from both layers", () => {
      cacheSet("del-key", "del-value", 60);
      cacheDelete("del-key");

      mockSelectAll.mockReturnValue([]);
      const result = cacheGet("del-key");
      expect(result).toBeNull();
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
  });

  describe("resetCacheStats", () => {
    it("resets all counters", () => {
      mockSelectAll.mockReturnValue([]);
      cacheGet("miss");
      resetCacheStats();
      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
