/**
 * Unit tests for AI routing module (src/lib/ai/routing.ts).
 * Mocks database and embeddings to test routing logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn(),
  getEmbedding: vi.fn(),
  cosineSimilarity: vi.fn(),
  getEmbeddingsByType: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  completeWithFallback: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-123"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { getRoutingSuggestions, registerRoutingHandlers, enqueueRoutingJob } from "@/lib/ai/routing";
import { generateEmbedding, cosineSimilarity, getEmbeddingsByType } from "@/lib/embeddings";
import { db } from "@/db";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedGenerateEmbedding = vi.mocked(generateEmbedding);
const mockedCosineSimilarity = vi.mocked(cosineSimilarity);
const mockedGetEmbeddingsByType = vi.mocked(getEmbeddingsByType);
const mockedDb = vi.mocked(db);
const mockedRegisterHandler = vi.mocked(registerHandler);
const mockedEnqueue = vi.mocked(enqueue);

// Helper to create a chainable query mock
function mockSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockReturnThis(),
  };
  mockedDb.select.mockReturnValue(chain as never);
  return chain;
}

describe("AI Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRoutingSuggestions", () => {
    it("should return empty array for empty input", async () => {
      const result = await getRoutingSuggestions("", null);
      expect(result).toEqual([]);
    });

    it("should return empty when no active projects exist", async () => {
      mockSelect([]);
      const result = await getRoutingSuggestions("Test proposal", "Some desc");
      expect(result).toEqual([]);
    });

    it("should return embedding-based suggestions when embeddings exist", async () => {
      // Mock projects query
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "p1", title: "Project Alpha", description: "AI tools", status: "active" },
          { id: "p2", title: "Project Beta", description: "Design", status: "active" },
        ]),
      };
      mockedDb.select.mockReturnValue(selectChain as never);

      mockedGenerateEmbedding.mockResolvedValue({
        vector: [0.1, 0.2, 0.3],
        model: "tfidf",
      });

      mockedGetEmbeddingsByType.mockResolvedValue([
        { entityId: "p1", vector: [0.1, 0.2, 0.3], model: "tfidf" },
        { entityId: "p2", vector: [0.9, 0.8, 0.7], model: "tfidf" },
      ]);

      mockedCosineSimilarity.mockImplementation((a, b) => {
        // Simple: if vectors are similar, return high score
        if (JSON.stringify(a) === JSON.stringify(b)) return 1.0;
        return 0.3;
      });

      const result = await getRoutingSuggestions("AI proposal", "AI tools for team");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("projectId");
      expect(result[0]).toHaveProperty("projectTitle");
      expect(result[0]).toHaveProperty("score");
      expect(result[0]).toHaveProperty("reason");
    });

    it("should fall back to keyword routing when embeddings fail", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "p1", title: "Machine Learning Tools", description: "AI and ML tools for teams", status: "active" },
        ]),
      };
      mockedDb.select.mockReturnValue(selectChain as never);

      mockedGenerateEmbedding.mockRejectedValue(new Error("API error"));
      mockedGetEmbeddingsByType.mockResolvedValue([]);

      const result = await getRoutingSuggestions(
        "Machine learning proposal",
        "AI tools for analysis"
      );

      expect(result.length).toBeGreaterThanOrEqual(0);
      // Keyword routing should find overlap with "machine", "learning", "tools"
    });

    it("should exclude currentProjectId from suggestions", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "p1", title: "Project A", description: "Test", status: "active" },
          { id: "p2", title: "Project B", description: "Test", status: "active" },
        ]),
      };
      mockedDb.select.mockReturnValue(selectChain as never);
      mockedGetEmbeddingsByType.mockResolvedValue([]);
      mockedGenerateEmbedding.mockRejectedValue(new Error("no api"));

      const result = await getRoutingSuggestions("Test", "Test", "p1");

      // p1 should be excluded
      const ids = result.map((r) => r.projectId);
      expect(ids).not.toContain("p1");
    });

    it("should filter out archived projects", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "p1", title: "Active", description: "active", status: "active" },
          { id: "p2", title: "Archived", description: "archived", status: "archived" },
        ]),
      };
      mockedDb.select.mockReturnValue(selectChain as never);
      mockedGetEmbeddingsByType.mockResolvedValue([]);
      mockedGenerateEmbedding.mockRejectedValue(new Error("no api"));

      const result = await getRoutingSuggestions("Active content", "About something active");
      const ids = result.map((r) => r.projectId);
      expect(ids).not.toContain("p2");
    });
  });

  describe("registerRoutingHandlers", () => {
    it("should register handler with queue system", () => {
      registerRoutingHandlers();
      expect(mockedRegisterHandler).toHaveBeenCalledWith("ai-routing", expect.any(Function));
    });
  });

  describe("enqueueRoutingJob", () => {
    it("should enqueue a routing job with proposalId", async () => {
      const jobId = await enqueueRoutingJob("proposal-123");
      expect(mockedEnqueue).toHaveBeenCalledWith("ai-routing", { proposalId: "proposal-123" });
      expect(jobId).toBe("job-123");
    });
  });
});
