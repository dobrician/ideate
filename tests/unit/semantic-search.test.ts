/**
 * Unit tests for the semantic search module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockFtsSearch = vi.fn().mockReturnValue([]);
vi.mock("@/lib/search", () => ({
  search: (...args: unknown[]) => mockFtsSearch(...args),
}));

const mockGenerateEmbedding = vi.fn().mockResolvedValue({
  vector: [0.5, 0.5],
  model: "tfidf",
});
const mockGetEmbedding = vi.fn().mockResolvedValue(null);
const mockFindSimilar = vi.fn().mockResolvedValue([]);
const mockGetEmbeddingsByType = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  getEmbedding: (...args: unknown[]) => mockGetEmbedding(...args),
  findSimilar: (...args: unknown[]) => mockFindSimilar(...args),
  cosineSimilarity: (a: number[], b: number[]) => {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    const mag = Math.sqrt(na) * Math.sqrt(nb);
    return mag === 0 ? 0 : dot / mag;
  },
  getEmbeddingsByType: (...args: unknown[]) => mockGetEmbeddingsByType(...args),
}));

const mockSelectWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: () => ({
        where: (...args: unknown[]) => {
          const result = mockSelectWhere(fields, ...args);
          return {
            limit: (n: number) => result?.limit?.(n) ?? Promise.resolve([]),
            ...result,
          };
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  projects: Symbol("projects"),
  proposals: Symbol("proposals"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import { semanticSearch, findSimilarProposals } from "@/lib/semantic-search";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Semantic Search", () => {
  describe("semanticSearch", () => {
    it("returns empty for short queries", async () => {
      expect(await semanticSearch("a")).toEqual([]);
      expect(await semanticSearch("")).toEqual([]);
    });

    it("uses FTS in fts mode", async () => {
      mockFtsSearch.mockReturnValue([
        { id: "p1", title: "Test", description: null, type: "project", snippet: "Test" },
      ]);

      const results = await semanticSearch("test query", { mode: "fts" });
      expect(results).toHaveLength(1);
      expect(results[0].method).toBe("fts");
      expect(mockFtsSearch).toHaveBeenCalledWith("test query", 20);
    });

    it("uses embedding search in semantic mode", async () => {
      // findSimilar is called once for projects and once for proposals
      mockFindSimilar
        .mockResolvedValueOnce([{ entityId: "proj-1", score: 0.85 }]) // projects
        .mockResolvedValueOnce([]); // proposals
      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{
          id: "proj-1", title: "ML Project", description: "About ML", projectId: undefined,
        }]),
      });

      const results = await semanticSearch("machine learning", { mode: "semantic" });
      expect(results).toHaveLength(1);
      expect(results[0].method).toBe("semantic");
      expect(results[0].score).toBe(0.85);
    });

    it("falls back to FTS when semantic fails", async () => {
      mockFindSimilar.mockRejectedValue(new Error("embedding error"));
      mockFtsSearch.mockReturnValue([
        { id: "p1", title: "Test", description: null, type: "project", snippet: "Test" },
      ]);

      const results = await semanticSearch("test", { mode: "semantic" });
      expect(results).toHaveLength(1);
      expect(results[0].method).toBe("fts");
    });

    it("filters low-score semantic results", async () => {
      mockFindSimilar.mockResolvedValue([
        { entityId: "proj-1", score: 0.05 }, // Below 0.1 threshold
      ]);

      const results = await semanticSearch("test", { mode: "semantic" });
      expect(results).toHaveLength(0);
    });

    it("uses hybrid mode by default", async () => {
      mockFtsSearch.mockReturnValue([
        { id: "p1", title: "Alpha", description: null, type: "project", snippet: "Alpha" },
      ]);
      mockFindSimilar.mockResolvedValue([
        { entityId: "p2", score: 0.7 },
      ]);
      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{
          id: "p2", title: "Beta", description: null, projectId: undefined,
        }]),
      });

      const results = await semanticSearch("test query");
      // Should have results from both FTS and semantic
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => r.method === "hybrid")).toBe(true);
    });

    it("merges duplicate results in hybrid mode", async () => {
      mockFtsSearch.mockReturnValue([
        { id: "p1", title: "Test", description: null, type: "project", snippet: "Test" },
      ]);
      // Semantic side also returns p1 for projects, nothing for proposals
      mockFindSimilar
        .mockResolvedValueOnce([{ entityId: "p1", score: 0.8 }]) // projects
        .mockResolvedValueOnce([]); // proposals
      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{
          id: "p1", title: "Test", description: null, projectId: undefined,
        }]),
      });

      const results = await semanticSearch("test", { mode: "hybrid" });
      // Same ID should be merged — only one result for p1
      const p1Results = results.filter((r) => r.id === "p1");
      expect(p1Results).toHaveLength(1);
      expect(p1Results[0].method).toBe("hybrid");
    });

    it("respects limit parameter", async () => {
      mockFtsSearch.mockReturnValue([
        { id: "p1", title: "Test 1", description: null, type: "project", snippet: "Test 1" },
        { id: "p2", title: "Test 2", description: null, type: "project", snippet: "Test 2" },
        { id: "p3", title: "Test 3", description: null, type: "project", snippet: "Test 3" },
      ]);
      mockFindSimilar.mockResolvedValue([]);

      const results = await semanticSearch("test", { limit: 2 });
      expect(results).toHaveLength(2);
    });
  });

  describe("findSimilarProposals", () => {
    it("returns empty when no embedding exists", async () => {
      mockGetEmbedding.mockResolvedValue(null);
      const results = await findSimilarProposals("p1");
      expect(results).toEqual([]);
    });

    it("returns similar proposals with scores", async () => {
      mockGetEmbedding.mockResolvedValue({
        vector: [0.5, 0.5],
        model: "tfidf",
      });
      mockFindSimilar.mockResolvedValue([
        { entityId: "p2", score: 0.9 },
        { entityId: "p3", score: 0.7 },
      ]);
      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{
          id: "p2", title: "Similar One", projectId: "proj-1",
        }]),
      });

      const results = await findSimilarProposals("p1", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe("Similar One");
    });

    it("filters low-score matches", async () => {
      mockGetEmbedding.mockResolvedValue({
        vector: [0.5, 0.5],
        model: "tfidf",
      });
      mockFindSimilar.mockResolvedValue([
        { entityId: "p2", score: 0.05 },
      ]);

      const results = await findSimilarProposals("p1");
      expect(results).toEqual([]);
    });

    it("handles errors gracefully", async () => {
      mockGetEmbedding.mockRejectedValue(new Error("db error"));
      const results = await findSimilarProposals("p1");
      expect(results).toEqual([]);
    });
  });
});
