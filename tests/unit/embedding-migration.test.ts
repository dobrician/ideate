/**
 * Unit tests for embedding model migration — getModelDistribution,
 * migrateEmbeddingModel, getEmbeddingMigrationStatus.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  embeddings: Symbol("embeddings"),
  projects: Symbol("projects"),
  proposals: Symbol("proposals"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getModelDistribution,
  migrateEmbeddingModel,
  getEmbeddingMigrationStatus,
} from "@/lib/embeddings";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENAI_API_KEY;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Embedding Model Migration", () => {
  describe("getModelDistribution", () => {
    it("returns distribution with percentages", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          groupBy: () =>
            Promise.resolve([
              { model: "tfidf", cnt: 30 },
              { model: "text-embedding-3-small", cnt: 70 },
            ]),
        }),
      });

      const dist = await getModelDistribution();
      expect(dist).toHaveLength(2);
      expect(dist[0]).toEqual({ model: "tfidf", count: 30, percentage: 30 });
      expect(dist[1]).toEqual({ model: "text-embedding-3-small", count: 70, percentage: 70 });
    });

    it("returns empty array when no embeddings", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          groupBy: () => Promise.resolve([]),
        }),
      });

      const dist = await getModelDistribution();
      expect(dist).toEqual([]);
    });

    it("handles single model", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          groupBy: () =>
            Promise.resolve([{ model: "tfidf", cnt: 50 }]),
        }),
      });

      const dist = await getModelDistribution();
      expect(dist).toHaveLength(1);
      expect(dist[0]).toEqual({ model: "tfidf", count: 50, percentage: 100 });
    });
  });

  describe("migrateEmbeddingModel", () => {
    it("returns zero queued when all already on target", async () => {
      // First select: count on target
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 50 }]),
        }),
      });
      // Second select: total count
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 50 }]),
      });

      const result = await migrateEmbeddingModel("tfidf");
      expect(result.queued).toBe(0);
      expect(result.alreadyCurrent).toBe(50);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("marks off-target embeddings as stale", async () => {
      // Count on target
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 20 }]),
        }),
      });
      // Total count
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 100 }]),
      });
      // Update mock
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      });

      const result = await migrateEmbeddingModel("text-embedding-3-small");
      expect(result.queued).toBe(80);
      expect(result.alreadyCurrent).toBe(20);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("handles empty database", async () => {
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 0 }]),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 0 }]),
      });

      const result = await migrateEmbeddingModel("tfidf");
      expect(result.queued).toBe(0);
      expect(result.alreadyCurrent).toBe(0);
    });
  });

  describe("getEmbeddingMigrationStatus", () => {
    it("returns 100% when all on target", async () => {
      // On target count
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 50 }]),
        }),
      });
      // Total count
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 50 }]),
      });

      const status = await getEmbeddingMigrationStatus();
      // targetModel depends on OPENAI_API_KEY at module load; just check structure
      expect(typeof status.targetModel).toBe("string");
      expect(status.onTarget).toBe(50);
      expect(status.offTarget).toBe(0);
      expect(status.progressPercent).toBe(100);
    });

    it("calculates progress when mixed models", async () => {
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 30 }]),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 100 }]),
      });

      const status = await getEmbeddingMigrationStatus();
      expect(status.offTarget).toBe(70);
      expect(status.progressPercent).toBe(30);
    });

    it("returns 100% when no embeddings exist", async () => {
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ cnt: 0 }]),
        }),
      });
      mockSelect.mockReturnValueOnce({
        from: () => Promise.resolve([{ cnt: 0 }]),
      });

      const status = await getEmbeddingMigrationStatus();
      expect(status.progressPercent).toBe(100);
      expect(status.total).toBe(0);
    });
  });
});
