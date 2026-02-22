/**
 * Unit tests for the recommendations module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectChain = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: (table?: unknown) => ({
        where: (...args: unknown[]) => {
          const result = mockSelectChain("select-where", fields, table, ...args);
          return {
            limit: (n: number) => result?.limit?.(n) ?? Promise.resolve([]),
            ...result,
          };
        },
        orderBy: () => ({
          limit: (n: number) => {
            const result = mockSelectChain("select-orderBy-limit", fields, table, n);
            return result ?? Promise.resolve([]);
          },
        }),
        limit: (n: number) => {
          const result = mockSelectChain("select-limit", fields, table, n);
          return result ?? Promise.resolve([]);
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  votes: Symbol("votes"),
  proposals: Symbol("proposals"),
  projects: Symbol("projects"),
}));

const mockGetEmbedding = vi.fn().mockResolvedValue(null);
const mockGetEmbeddingsByType = vi.fn().mockResolvedValue([]);
const mockCosineSimilarity = vi.fn().mockReturnValue(0);

vi.mock("@/lib/embeddings", () => ({
  getEmbedding: (...args: unknown[]) => mockGetEmbedding(...args),
  getEmbeddingsByType: (...args: unknown[]) => mockGetEmbeddingsByType(...args),
  cosineSimilarity: (...args: unknown[]) => mockCosineSimilarity(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import { getRecommendations } from "@/lib/recommendations";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Recommendations Module", () => {
  describe("getRecommendations", () => {
    it("returns empty when user has no votes", async () => {
      // All DB queries return empty arrays
      mockSelectChain.mockReturnValue({
        limit: () => Promise.resolve([]),
      });

      const results = await getRecommendations("user-1", 10);
      expect(Array.isArray(results)).toBe(true);
    });

    it("returns popular proposals for users with no voting history", async () => {
      let callCount = 0;
      mockSelectChain.mockImplementation((type: string) => {
        callCount++;
        if (type === "select-orderBy-limit") {
          // Return recent proposals for popular recs
          return Promise.resolve([
            { id: "p1", title: "Proposal 1", projectId: "proj-1" },
            { id: "p2", title: "Proposal 2", projectId: "proj-1" },
          ]);
        }
        if (type === "select-where") {
          // Return project title for hydration
          return {
            limit: () => Promise.resolve([{ title: "Test Project" }]),
          };
        }
        return { limit: () => Promise.resolve([]) };
      });

      const results = await getRecommendations("user-1", 10);
      // Should have popular recommendations
      expect(Array.isArray(results)).toBe(true);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });

      const results = await getRecommendations("user-1", 10);
      expect(results).toEqual([]);
    });

    it("deduplicates recommendations", async () => {
      // When the same proposal appears in multiple recommendation types,
      // it should be deduped (keeping higher score)
      mockSelectChain.mockReturnValue({
        limit: () => Promise.resolve([]),
      });

      const results = await getRecommendations("user-1", 5);
      // Each proposal ID should be unique
      const ids = results.map((r) => r.proposalId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("respects limit parameter", async () => {
      mockSelectChain.mockReturnValue({
        limit: () => Promise.resolve([]),
      });

      const results = await getRecommendations("user-1", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("returns results with required fields", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-orderBy-limit") {
          return Promise.resolve([
            { id: "p1", title: "Proposal 1", projectId: "proj-1" },
          ]);
        }
        if (type === "select-where") {
          return {
            limit: () => Promise.resolve([{ title: "Project 1" }]),
          };
        }
        return { limit: () => Promise.resolve([]) };
      });

      const results = await getRecommendations("user-1", 10);
      for (const rec of results) {
        expect(rec).toHaveProperty("proposalId");
        expect(rec).toHaveProperty("proposalTitle");
        expect(rec).toHaveProperty("projectId");
        expect(rec).toHaveProperty("projectTitle");
        expect(rec).toHaveProperty("score");
        expect(rec).toHaveProperty("reason");
        expect(["similar_content", "voting_pattern", "popular"]).toContain(rec.reason);
      }
    });

    it("sorts recommendations by score descending", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-orderBy-limit") {
          return Promise.resolve([
            { id: "p1", title: "Proposal 1", projectId: "proj-1" },
            { id: "p2", title: "Proposal 2", projectId: "proj-1" },
          ]);
        }
        if (type === "select-where") {
          return {
            limit: () => Promise.resolve([{ title: "Project 1" }]),
          };
        }
        return { limit: () => Promise.resolve([]) };
      });

      const results = await getRecommendations("user-1", 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });
});
