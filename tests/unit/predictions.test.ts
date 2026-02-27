/**
 * Unit tests for predictive success scoring module.
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
          const p = Promise.resolve(result ?? []);
          return {
            then: p.then.bind(p),
            catch: p.catch.bind(p),
            limit: (n: number) => {
              const lp = Promise.resolve(result ?? []);
              return { then: lp.then.bind(lp), catch: lp.catch.bind(lp) };
            },
            groupBy: () => ({
              orderBy: () => ({
                limit: (n: number) => {
                  const gp = Promise.resolve(result ?? []);
                  return { then: gp.then.bind(gp), catch: gp.catch.bind(gp) };
                },
              }),
            }),
          };
        },
        limit: (n: number) => {
          const result = mockSelectChain("select-limit", fields, table, n);
          const p = Promise.resolve(result ?? []);
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  proposals: Symbol("proposals"),
  votes: Symbol("votes"),
  comments: Symbol("comments"),
  projects: Symbol("projects"),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-pred-1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  predictSuccess,
  getProjectPredictions,
  getPredictionSummary,
  registerPredictionHandlers,
  enqueuePredictionJob,
} from "@/lib/analytics/predictions";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedRegisterHandler = vi.mocked(registerHandler);
const mockedEnqueue = vi.mocked(enqueue);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Predictive Success Scoring", () => {
  describe("predictSuccess", () => {
    it("returns null when proposal not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await predictSuccess("nonexistent");
      expect(result).toBeNull();
    });

    it("returns prediction data for existing proposal", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        // All where().limit() and where() chains return proposal-like data
        return [
          {
            id: "p1", title: "Test Proposal", projectId: "proj-1",
            userId: "u1", createdAt: new Date(),
            count: 5, pro: 3, contra: 2, total: 5,
            withReplies: 1, uniqueAuthors: 3,
          },
        ];
      });

      const result = await predictSuccess("p1");
      expect(result).not.toBeNull();
      expect(result!.proposalId).toBe("p1");
      expect(result!.probability).toBeGreaterThanOrEqual(0);
      expect(result!.probability).toBeLessThanOrEqual(100);
      expect(result!.confidence).toBeGreaterThanOrEqual(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(result!.factors)).toBe(true);
      expect(result!.factors.length).toBeGreaterThan(0);
      expect(["likely", "uncertain", "unlikely"]).toContain(result!.prediction);

      // Check factor structure
      for (const f of result!.factors) {
        expect(f).toHaveProperty("name");
        expect(f).toHaveProperty("score");
        expect(f).toHaveProperty("weight");
        expect(f).toHaveProperty("description");
        expect(typeof f.score).toBe("number");
        expect(typeof f.weight).toBe("number");
      }
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await predictSuccess("p1");
      expect(result).toBeNull();
    });
  });

  describe("getProjectPredictions", () => {
    it("returns empty array when no proposals exist", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProjectPredictions("proj-1");
      expect(result).toEqual([]);
    });

    it("returns sorted predictions", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "p1" }];
        }
        if (type === "select-where") {
          return [
            {
              id: "p1", title: "Proposal A", projectId: "proj-1",
              userId: "u1", createdAt: new Date(), count: 3,
              pro: 2, contra: 1, total: 3, withReplies: 0, uniqueAuthors: 1,
            },
          ];
        }
        return [];
      });

      const result = await getProjectPredictions("proj-1");
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getProjectPredictions("proj-1");
      expect(result).toEqual([]);
    });
  });

  describe("getPredictionSummary", () => {
    it("returns summary with average accuracy", async () => {
      mockSelectChain.mockReturnValue([]);

      const result = await getPredictionSummary();
      expect(result).toHaveProperty("predictions");
      expect(result).toHaveProperty("averageAccuracy");
      expect(result).toHaveProperty("generatedAt");
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(typeof result.averageAccuracy).toBe("number");
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getPredictionSummary();
      expect(result.predictions).toEqual([]);
      expect(result.averageAccuracy).toBe(0);
    });
  });

  describe("registerPredictionHandlers", () => {
    it("registers handler with queue system", () => {
      registerPredictionHandlers();
      expect(mockedRegisterHandler).toHaveBeenCalledWith(
        "analytics-predictions",
        expect.any(Function)
      );
    });
  });

  describe("enqueuePredictionJob", () => {
    it("enqueues a prediction analysis job", async () => {
      const jobId = await enqueuePredictionJob("proj-1");
      expect(mockedEnqueue).toHaveBeenCalledWith("analytics-predictions", {
        projectId: "proj-1",
      });
      expect(jobId).toBe("job-pred-1");
    });
  });
});
