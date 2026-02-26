/**
 * Unit tests for AI roadmap generation (src/lib/ai/roadmap.ts).
 * Mocks database and embeddings to test clustering and milestone logic.
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
  getEmbeddingsByType: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-road-1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { generateRoadmap, registerRoadmapHandlers, enqueueRoadmapGeneration } from "@/lib/ai/roadmap";
import { getEmbeddingsByType, cosineSimilarity } from "@/lib/embeddings";
import { db } from "@/db";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedDb = vi.mocked(db);
const mockedGetEmbeddingsByType = vi.mocked(getEmbeddingsByType);
const mockedCosineSimilarity = vi.mocked(cosineSimilarity);

describe("AI Roadmap Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateRoadmap", () => {
    it("should return null when project not found", async () => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      chain.then = (resolve: (v: unknown) => void) => resolve([]);
      mockedDb.select.mockReturnValue(chain as never);

      const result = await generateRoadmap("nonexistent");
      expect(result).toBeNull();
    });

    it("should return empty milestones when project has no proposals", async () => {
      let callCount = 0;
      const now = new Date();
      const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      mockedDb.select.mockImplementation(() => {
        callCount++;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);

        if (callCount === 1) {
          // Project found
          chain.limit = vi.fn().mockResolvedValue([
            { id: "p1", title: "Test Project", deadline: future, createdAt: now },
          ]);
        } else {
          // No proposals
          chain.then = (resolve: (v: unknown) => void) => resolve([]);
          chain.limit = vi.fn().mockResolvedValue([]);
        }
        return chain as never;
      });

      const result = await generateRoadmap("p1");
      expect(result).not.toBeNull();
      expect(result!.milestones).toEqual([]);
      expect(result!.projectTitle).toBe("Test Project");
    });

    it("should generate milestones from proposals with vote scores", async () => {
      const now = new Date();
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      let callCount = 0;

      mockedDb.select.mockImplementation(() => {
        callCount++;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        chain.innerJoin = vi.fn().mockReturnValue(chain);

        if (callCount === 1) {
          // Project
          chain.limit = vi.fn().mockResolvedValue([
            { id: "proj1", title: "My Project", deadline: future, createdAt: now },
          ]);
        } else if (callCount === 2) {
          // Proposals
          chain.then = (resolve: (v: unknown) => void) => resolve([
            { id: "pr1", title: "Proposal A", description: "First", createdAt: now },
            { id: "pr2", title: "Proposal B", description: "Second", createdAt: now },
          ]);
          chain.limit = vi.fn().mockResolvedValue([
            { id: "pr1", title: "Proposal A", description: "First", createdAt: now },
            { id: "pr2", title: "Proposal B", description: "Second", createdAt: now },
          ]);
        } else {
          // Vote scores
          chain.then = (resolve: (v: unknown) => void) => resolve([{ total: 5 }]);
          chain.limit = vi.fn().mockResolvedValue([{ total: 5 }]);
        }
        return chain as never;
      });

      mockedGetEmbeddingsByType.mockResolvedValue([]);

      const result = await generateRoadmap("proj1");
      expect(result).not.toBeNull();
      expect(result!.milestones.length).toBeGreaterThan(0);
      expect(result!.generatedAt).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      mockedDb.select.mockImplementation(() => {
        throw new Error("DB error");
      });

      const result = await generateRoadmap("project-1");
      expect(result).toBeNull();
    });
  });

  describe("registerRoadmapHandlers", () => {
    it("should register handler with queue system", () => {
      registerRoadmapHandlers();
      expect(vi.mocked(registerHandler)).toHaveBeenCalledWith(
        "ai-roadmap",
        expect.any(Function)
      );
    });
  });

  describe("enqueueRoadmapGeneration", () => {
    it("should enqueue a roadmap generation job", async () => {
      const jobId = await enqueueRoadmapGeneration("project-1");
      expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
        "ai-roadmap",
        { projectId: "project-1" }
      );
      expect(jobId).toBe("job-road-1");
    });
  });
});
