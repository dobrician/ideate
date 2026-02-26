/**
 * Unit tests for AI conflict detection (src/lib/ai/conflicts.ts).
 * Mocks database, embeddings, and LLM to test conflict logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/embeddings", () => ({
  getEmbedding: vi.fn(),
  getEmbeddingsByType: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-456"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { detectConflicts, checkProposalConflicts, registerConflictHandlers, enqueueConflictDetection } from "@/lib/ai/conflicts";
import { getEmbeddingsByType, cosineSimilarity, getEmbedding } from "@/lib/embeddings";
import { completeWithFallback } from "@/lib/llm";
import { db } from "@/db";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedDb = vi.mocked(db);
const mockedGetEmbeddingsByType = vi.mocked(getEmbeddingsByType);
const mockedCosineSimilarity = vi.mocked(cosineSimilarity);
const mockedGetEmbedding = vi.mocked(getEmbedding);
const mockedComplete = vi.mocked(completeWithFallback);

/**
 * Create a thenable chain mock — Drizzle query builders are thenable,
 * so `await db.select().from().where()` resolves via `.then()`.
 */
function mockSelectThenable(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  // Make the chain itself thenable so `await chain` resolves to rows
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  mockedDb.select.mockReturnValue(chain as never);
  return chain;
}

describe("AI Conflict Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectConflicts", () => {
    it("should return empty array for project with fewer than 2 proposals", async () => {
      mockSelectThenable([{ id: "prop1", title: "Only one", description: null }]);
      const result = await detectConflicts("project-1");
      expect(result).toEqual([]);
    });

    it("should detect conflicts using LLM when available", async () => {
      mockSelectThenable([
        { id: "p1", title: "Increase budget", description: "We should increase spending" },
        { id: "p2", title: "Decrease budget", description: "We should cut costs" },
      ]);

      mockedGetEmbeddingsByType.mockResolvedValue([
        { entityId: "p1", vector: [0.5, 0.5], model: "tfidf" },
        { entityId: "p2", vector: [0.5, 0.4], model: "tfidf" },
      ]);
      mockedCosineSimilarity.mockReturnValue(0.8);

      mockedComplete.mockResolvedValue({
        text: JSON.stringify({
          conflict: true,
          severity: "high",
          confidence: 90,
          explanation: "Directly opposing budget directions",
        }),
        modelUsed: "gemini",
      });

      const result = await detectConflicts("project-1");

      expect(result.length).toBe(1);
      expect(result[0].severity).toBe("high");
      expect(result[0].confidence).toBe(90);
      expect(result[0].proposalAId).toBe("p1");
      expect(result[0].proposalBId).toBe("p2");
    });

    it("should fall back to heuristic when LLM returns no conflict", async () => {
      mockSelectThenable([
        { id: "p1", title: "Enable feature X", description: null },
        { id: "p2", title: "Disable feature X", description: null },
      ]);

      mockedGetEmbeddingsByType.mockResolvedValue([]);
      mockedComplete.mockResolvedValue({ text: null, modelUsed: null });

      const result = await detectConflicts("project-1", 0.0);

      // Heuristic should detect "enable" vs "disable" contradiction
      expect(result.length).toBe(1);
      expect(result[0].explanation).toContain("contradictory keyword pair");
    });

    it("should return empty array when proposals are unrelated", async () => {
      mockSelectThenable([
        { id: "p1", title: "Add login page", description: "New login UI" },
        { id: "p2", title: "Fix search results", description: "Improve search" },
      ]);

      mockedGetEmbeddingsByType.mockResolvedValue([
        { entityId: "p1", vector: [1, 0], model: "tfidf" },
        { entityId: "p2", vector: [0, 1], model: "tfidf" },
      ]);
      mockedCosineSimilarity.mockReturnValue(0.05);

      const result = await detectConflicts("project-1");
      expect(result).toEqual([]);
    });

    it("should handle errors gracefully", async () => {
      mockedDb.select.mockImplementation(() => { throw new Error("DB error"); });
      const result = await detectConflicts("project-1");
      expect(result).toEqual([]);
    });
  });

  describe("checkProposalConflicts", () => {
    it("should return empty when proposal not found", async () => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      chain.then = (resolve: (v: unknown) => void) => resolve([]);
      mockedDb.select.mockReturnValue(chain as never);

      const result = await checkProposalConflicts("nonexistent");
      expect(result).toEqual([]);
    });
  });

  describe("registerConflictHandlers", () => {
    it("should register handler with queue system", () => {
      registerConflictHandlers();
      expect(vi.mocked(registerHandler)).toHaveBeenCalledWith(
        "ai-conflict-detection",
        expect.any(Function)
      );
    });
  });

  describe("enqueueConflictDetection", () => {
    it("should enqueue a conflict detection job", async () => {
      const jobId = await enqueueConflictDetection("project-1");
      expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
        "ai-conflict-detection",
        { projectId: "project-1" }
      );
      expect(jobId).toBe("job-456");
    });
  });
});
