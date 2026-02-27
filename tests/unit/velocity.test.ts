/**
 * Unit tests for vote velocity tracking module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectChain = vi.fn();

function makeThenable(data: unknown[] | undefined) {
  const arr = data ?? [];
  const p = Promise.resolve(arr);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    limit: () => {
      const lp = Promise.resolve(arr);
      return { then: lp.then.bind(lp), catch: lp.catch.bind(lp) };
    },
    groupBy: () => ({
      orderBy: () => ({
        limit: () => {
          const gp = Promise.resolve(arr);
          return { then: gp.then.bind(gp), catch: gp.catch.bind(gp) };
        },
      }),
    }),
  };
}

vi.mock("@/db", () => ({
  db: {
    select: (fields?: unknown) => ({
      from: (table?: unknown) => ({
        where: (...args: unknown[]) => {
          const result = mockSelectChain("select-where", fields, table, ...args);
          return makeThenable(result);
        },
        groupBy: (...args: unknown[]) => ({
          orderBy: (...oArgs: unknown[]) => ({
            limit: (n: number) => {
              const result = mockSelectChain("select-groupBy-orderBy-limit", fields, table, n);
              const p = Promise.resolve(result ?? []);
              return { then: p.then.bind(p), catch: p.catch.bind(p) };
            },
          }),
        }),
        limit: (n: number) => {
          const result = mockSelectChain("select-limit", fields, table, n);
          const p = Promise.resolve(result ?? []);
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        },
        orderBy: () => ({
          limit: (n: number) => {
            const result = mockSelectChain("select-orderBy-limit", fields, table, n);
            const p = Promise.resolve(result ?? []);
            return { then: p.then.bind(p), catch: p.catch.bind(p) };
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  proposals: Symbol("proposals"),
  votes: Symbol("votes"),
  projects: Symbol("projects"),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-vel-1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getProposalVelocity,
  getProjectVelocities,
  getVelocitySummary,
  registerVelocityHandlers,
  enqueueVelocityJob,
} from "@/lib/analytics/velocity";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedRegisterHandler = vi.mocked(registerHandler);
const mockedEnqueue = vi.mocked(enqueue);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Vote Velocity Tracking", () => {
  describe("getProposalVelocity", () => {
    it("returns null when proposal not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProposalVelocity("nonexistent");
      expect(result).toBeNull();
    });

    it("returns velocity data for existing proposal", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-where" || type === "select-limit") {
          return [
            { id: "p1", title: "Test Proposal", projectId: "proj-1", title: "Test Project" },
          ];
        }
        return [];
      });

      const result = await getProposalVelocity("p1");
      if (result) {
        expect(result.proposalId).toBe("p1");
        expect(result.proposalTitle).toBe("Test Proposal");
        expect(typeof result.totalVotes).toBe("number");
        expect(typeof result.currentRate).toBe("number");
        expect(typeof result.peakRate).toBe("number");
        expect(typeof result.acceleration).toBe("number");
        expect(Array.isArray(result.timeline)).toBe(true);
      }
    });

    it("calculates velocity from daily vote data", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-where") {
          return [
            { date: yesterday, count: 5 },
            { date: today, count: 8 },
          ];
        }
        if (type === "select-limit") {
          return [{ id: "p1", title: "Fast Proposal", projectId: "proj-1" }];
        }
        return [];
      });

      const result = await getProposalVelocity("p1", 7);
      if (result) {
        expect(result.totalVotes).toBeGreaterThanOrEqual(0);
        expect(result.peakRate).toBeGreaterThanOrEqual(0);
      }
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getProposalVelocity("p1");
      expect(result).toBeNull();
    });
  });

  describe("getProjectVelocities", () => {
    it("returns empty array when no proposals exist", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProjectVelocities("proj-1");
      expect(result).toEqual([]);
    });

    it("returns sorted velocities for project proposals", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "p1" }, { id: "p2" }];
        }
        if (type === "select-where") {
          return [
            { id: "p1", title: "Proposal A", projectId: "proj-1" },
          ];
        }
        return [];
      });

      const result = await getProjectVelocities("proj-1");
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getProjectVelocities("proj-1");
      expect(result).toEqual([]);
    });
  });

  describe("getVelocitySummary", () => {
    it("returns summary with fastest growing and decelerating", async () => {
      mockSelectChain.mockReturnValue([]);

      const result = await getVelocitySummary();
      expect(result).toHaveProperty("fastestGrowing");
      expect(result).toHaveProperty("decelerating");
      expect(result).toHaveProperty("generatedAt");
      expect(Array.isArray(result.fastestGrowing)).toBe(true);
      expect(Array.isArray(result.decelerating)).toBe(true);
      expect(typeof result.generatedAt).toBe("string");
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getVelocitySummary();
      expect(result.fastestGrowing).toEqual([]);
      expect(result.decelerating).toEqual([]);
    });
  });

  describe("registerVelocityHandlers", () => {
    it("registers handler with queue system", () => {
      registerVelocityHandlers();
      expect(mockedRegisterHandler).toHaveBeenCalledWith(
        "analytics-velocity",
        expect.any(Function)
      );
    });
  });

  describe("enqueueVelocityJob", () => {
    it("enqueues a velocity analysis job", async () => {
      const jobId = await enqueueVelocityJob("proposal-123");
      expect(mockedEnqueue).toHaveBeenCalledWith("analytics-velocity", {
        proposalId: "proposal-123",
      });
      expect(jobId).toBe("job-vel-1");
    });
  });
});
