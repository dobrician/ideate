/**
 * Unit tests for embedding job handlers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRegisterHandler = vi.fn();
const mockEnqueue = vi.fn().mockResolvedValue("job-1");

vi.mock("@/lib/queue", () => ({
  registerHandler: (...args: unknown[]) => mockRegisterHandler(...args),
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

const mockGenerateEmbedding = vi.fn().mockResolvedValue({
  vector: [0.1, 0.2, 0.3],
  model: "tfidf",
});
const mockStoreEmbedding = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  storeEmbedding: (...args: unknown[]) => mockStoreEmbedding(...args),
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
  comments: Symbol("comments"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import { registerEmbeddingHandlers, enqueueEmbedding } from "@/lib/embeddings/jobs";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Embedding Jobs", () => {
  describe("registerEmbeddingHandlers", () => {
    it("registers the generate_embedding handler", () => {
      registerEmbeddingHandlers();
      expect(mockRegisterHandler).toHaveBeenCalledWith(
        "generate_embedding",
        expect.any(Function)
      );
    });
  });

  describe("enqueueEmbedding", () => {
    it("enqueues a generate_embedding job", async () => {
      const id = await enqueueEmbedding("proposal", "p1");
      expect(id).toBe("job-1");
      expect(mockEnqueue).toHaveBeenCalledWith("generate_embedding", {
        entityType: "proposal",
        entityId: "p1",
      });
    });
  });

  describe("handleGenerateEmbedding (via registered handler)", () => {
    it("generates and stores embedding for a proposal", async () => {
      registerEmbeddingHandlers();
      const handler = mockRegisterHandler.mock.calls[0][1];

      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{ title: "Test Proposal", description: "A test" }]),
      });

      await handler({ entityType: "proposal", entityId: "p1" });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith("Test Proposal A test");
      expect(mockStoreEmbedding).toHaveBeenCalledWith(
        "proposal", "p1", [0.1, 0.2, 0.3], "tfidf"
      );
    });

    it("generates and stores embedding for a project", async () => {
      registerEmbeddingHandlers();
      const handler = mockRegisterHandler.mock.calls[0][1];

      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{ title: "Test Project", description: "Desc" }]),
      });

      await handler({ entityType: "project", entityId: "proj-1" });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith("Test Project Desc");
      expect(mockStoreEmbedding).toHaveBeenCalledWith(
        "project", "proj-1", [0.1, 0.2, 0.3], "tfidf"
      );
    });

    it("generates and stores embedding for a comment", async () => {
      registerEmbeddingHandlers();
      const handler = mockRegisterHandler.mock.calls[0][1];

      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{ content: "Great idea!" }]),
      });

      await handler({ entityType: "comment", entityId: "c1" });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith("Great idea!");
    });

    it("skips when entity not found", async () => {
      registerEmbeddingHandlers();
      const handler = mockRegisterHandler.mock.calls[0][1];

      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([]),
      });

      await handler({ entityType: "proposal", entityId: "missing" });

      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
      expect(mockStoreEmbedding).not.toHaveBeenCalled();
    });

    it("throws on missing payload fields", async () => {
      registerEmbeddingHandlers();
      const handler = mockRegisterHandler.mock.calls[0][1];

      await expect(handler({})).rejects.toThrow("Missing entityType or entityId");
    });
  });
});
