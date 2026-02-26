/**
 * Unit tests for AI deadline prediction (src/lib/ai/deadlines.ts).
 * Mocks database to test prediction and health logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-789"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { predictDeadline, assessDeadlineHealth, registerDeadlineHandlers, enqueueDeadlineAnalysis } from "@/lib/ai/deadlines";
import { db } from "@/db";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedDb = vi.mocked(db);

/**
 * Create a thenable chain that resolves when awaited directly or via .limit()
 */
function mockSelectThenable(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve(rows);
  mockedDb.select.mockReturnValue(chain as never);
  return chain;
}

describe("AI Deadline Prediction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("predictDeadline", () => {
    it("should return 14-day default when no historical data", async () => {
      // First call: archived projects (empty), second call: avg proposals
      let callCount = 0;
      mockedDb.select.mockImplementation(() => {
        callCount++;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue([]);
        chain.then = (resolve: (v: unknown) => void) => resolve([]);
        return chain as never;
      });

      const result = await predictDeadline("New project");

      expect(result.confidence).toBe(20);
      expect(result.basedOnCount).toBe(0);
      expect(result.reasoning).toContain("14-day default");
      expect(result.suggestedDeadline).toBeInstanceOf(Date);

      // Should be ~14 days from now
      const diffDays = (result.suggestedDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(13);
      expect(diffDays).toBeLessThan(15);
    });

    it("should use historical median when data is available", async () => {
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      let callCount = 0;
      mockedDb.select.mockImplementation(() => {
        callCount++;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue([]);
        chain.innerJoin = vi.fn().mockReturnValue(chain);

        if (callCount === 1) {
          // Archived projects with durations: 7, 14, 21 days → median = 14
          const archivedData = [
            { id: "p1", createdAt: new Date(now - 7 * DAY_MS), deadline: new Date(now) },
            { id: "p2", createdAt: new Date(now - 14 * DAY_MS), deadline: new Date(now) },
            { id: "p3", createdAt: new Date(now - 21 * DAY_MS), deadline: new Date(now) },
          ];
          chain.then = (resolve: (v: unknown) => void) => resolve(archivedData);
        } else {
          chain.then = (resolve: (v: unknown) => void) => resolve([{ avg: 5 }]);
        }
        return chain as never;
      });

      const result = await predictDeadline("Test project");

      expect(result.basedOnCount).toBe(3);
      expect(result.confidence).toBeGreaterThan(20);
      expect(result.reasoning).toContain("3 historical project");
    });

    it("should handle errors gracefully with fallback", async () => {
      mockedDb.select.mockImplementation(() => {
        throw new Error("DB error");
      });

      const result = await predictDeadline("Error project");

      expect(result.confidence).toBe(10);
      expect(result.reasoning).toContain("failed");
    });
  });

  describe("assessDeadlineHealth", () => {
    it("should return null when project not found", async () => {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      chain.then = (resolve: (v: unknown) => void) => resolve([]);
      mockedDb.select.mockReturnValue(chain as never);

      const result = await assessDeadlineHealth("nonexistent");
      expect(result).toBeNull();
    });

    it("should detect overdue projects", async () => {
      const pastDeadline = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const created = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      let callCount = 0;
      mockedDb.select.mockImplementation(() => {
        callCount++;
        const chain: Record<string, unknown> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockResolvedValue([]);
        chain.innerJoin = vi.fn().mockReturnValue(chain);

        if (callCount === 1) {
          chain.limit = vi.fn().mockResolvedValue([
            { id: "p1", deadline: pastDeadline, createdAt: created },
          ]);
        } else {
          chain.then = (resolve: (v: unknown) => void) => resolve([{ count: 5 }]);
        }
        return chain as never;
      });

      const result = await assessDeadlineHealth("p1");
      expect(result).not.toBeNull();
      expect(result!.health).toBe("overdue");
      expect(result!.daysRemaining).toBeLessThan(0);
    });

    it("should handle errors gracefully", async () => {
      mockedDb.select.mockImplementation(() => {
        throw new Error("DB error");
      });

      const result = await assessDeadlineHealth("p1");
      expect(result).toBeNull();
    });
  });

  describe("registerDeadlineHandlers", () => {
    it("should register handler with queue system", () => {
      registerDeadlineHandlers();
      expect(vi.mocked(registerHandler)).toHaveBeenCalledWith(
        "ai-deadline-analysis",
        expect.any(Function)
      );
    });
  });

  describe("enqueueDeadlineAnalysis", () => {
    it("should enqueue a deadline analysis job", async () => {
      const jobId = await enqueueDeadlineAnalysis("project-1");
      expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
        "ai-deadline-analysis",
        { projectId: "project-1" }
      );
      expect(jobId).toBe("job-789");
    });
  });
});
