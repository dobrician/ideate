/**
 * Unit tests for embedding freshness tracking and auto-regeneration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  embeddings: Symbol("embeddings"),
  projects: Symbol("projects"),
  proposals: Symbol("proposals"),
  comments: Symbol("comments"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getEmbeddingMaxAgeDays,
  getStaleEmbeddings,
  getEmbeddingFreshnessStats,
} from "@/lib/embeddings";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.EMBEDDING_MAX_AGE_DAYS;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Embedding Freshness", () => {
  describe("getEmbeddingMaxAgeDays", () => {
    it("returns default 30 when env not set", () => {
      expect(getEmbeddingMaxAgeDays()).toBe(30);
    });

    it("returns env value when valid", () => {
      process.env.EMBEDDING_MAX_AGE_DAYS = "14";
      expect(getEmbeddingMaxAgeDays()).toBe(14);
    });

    it("returns default for invalid env value", () => {
      process.env.EMBEDDING_MAX_AGE_DAYS = "xyz";
      expect(getEmbeddingMaxAgeDays()).toBe(30);
    });

    it("returns default for zero", () => {
      process.env.EMBEDDING_MAX_AGE_DAYS = "0";
      expect(getEmbeddingMaxAgeDays()).toBe(30);
    });

    it("returns default for negative", () => {
      process.env.EMBEDDING_MAX_AGE_DAYS = "-5";
      expect(getEmbeddingMaxAgeDays()).toBe(30);
    });
  });

  describe("getStaleEmbeddings", () => {
    it("returns stale embeddings from DB", async () => {
      const staleData = [
        { id: "e1", entityType: "project", entityId: "p1", updatedAt: new Date("2026-01-01") },
      ];
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(staleData),
          }),
        }),
      });

      const result = await getStaleEmbeddings(30, 10);
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe("p1");
    });

    it("uses default maxAgeDays from env", async () => {
      process.env.EMBEDDING_MAX_AGE_DAYS = "7";
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      const result = await getStaleEmbeddings();
      expect(result).toEqual([]);
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe("getEmbeddingFreshnessStats", () => {
    it("returns stats from DB", async () => {
      mockSelect.mockReturnValue({
        from: () => Promise.resolve([{ total: 100, staleCount: 15, avgAge: 12.5 }]),
      });

      const stats = await getEmbeddingFreshnessStats();
      expect(stats.fresh).toBe(85);
      expect(stats.stale).toBe(15);
      expect(stats.avgAgeDays).toBe(12.5);
    });

    it("handles empty DB", async () => {
      mockSelect.mockReturnValue({
        from: () => Promise.resolve([{ total: 0, staleCount: 0, avgAge: 0 }]),
      });

      const stats = await getEmbeddingFreshnessStats();
      expect(stats.fresh).toBe(0);
      expect(stats.stale).toBe(0);
      expect(stats.avgAgeDays).toBe(0);
    });
  });
});
