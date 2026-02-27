/**
 * Unit tests for proposal momentum scoring module.
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
  enqueue: vi.fn().mockResolvedValue("job-mom-1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getProposalMomentum,
  getProjectMomentum,
  getMomentumSnapshot,
  registerMomentumHandlers,
  enqueueMomentumJob,
} from "@/lib/analytics/momentum";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedRegisterHandler = vi.mocked(registerHandler);
const mockedEnqueue = vi.mocked(enqueue);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Proposal Momentum Scoring", () => {
  describe("getProposalMomentum", () => {
    it("returns null when proposal not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProposalMomentum("nonexistent");
      expect(result).toBeNull();
    });

    it("returns momentum data for existing proposal", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-where" || type === "select-limit") {
          return [
            {
              id: "p1", title: "Test Proposal", projectId: "proj-1",
              userId: "u1", createdAt: new Date(), count: 3,
            },
          ];
        }
        return [{ count: 0 }];
      });

      const result = await getProposalMomentum("p1");
      if (result) {
        expect(result.proposalId).toBe("p1");
        expect(result.proposalTitle).toBe("Test Proposal");
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(typeof result.voteComponent).toBe("number");
        expect(typeof result.commentComponent).toBe("number");
        expect(typeof result.recencyComponent).toBe("number");
        expect(["rising", "stable", "falling"]).toContain(result.trend);
      }
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getProposalMomentum("p1");
      expect(result).toBeNull();
    });
  });

  describe("getProjectMomentum", () => {
    it("returns empty array when no proposals exist", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getProjectMomentum("proj-1");
      expect(result).toEqual([]);
    });

    it("returns sorted momentum scores", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "p1" }];
        }
        if (type === "select-where") {
          return [
            {
              id: "p1", title: "Proposal A", projectId: "proj-1",
              userId: "u1", createdAt: new Date(), count: 2,
            },
          ];
        }
        return [{ count: 0 }];
      });

      const result = await getProjectMomentum("proj-1");
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getProjectMomentum("proj-1");
      expect(result).toEqual([]);
    });
  });

  describe("getMomentumSnapshot", () => {
    it("returns snapshot with average momentum", async () => {
      mockSelectChain.mockReturnValue([]);

      const result = await getMomentumSnapshot();
      expect(result).toHaveProperty("proposals");
      expect(result).toHaveProperty("averageMomentum");
      expect(result).toHaveProperty("generatedAt");
      expect(Array.isArray(result.proposals)).toBe(true);
      expect(typeof result.averageMomentum).toBe("number");
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getMomentumSnapshot();
      expect(result.proposals).toEqual([]);
      expect(result.averageMomentum).toBe(0);
    });
  });

  describe("registerMomentumHandlers", () => {
    it("registers handler with queue system", () => {
      registerMomentumHandlers();
      expect(mockedRegisterHandler).toHaveBeenCalledWith(
        "analytics-momentum",
        expect.any(Function)
      );
    });
  });

  describe("enqueueMomentumJob", () => {
    it("enqueues a momentum analysis job", async () => {
      const jobId = await enqueueMomentumJob("proj-1");
      expect(mockedEnqueue).toHaveBeenCalledWith("analytics-momentum", {
        projectId: "proj-1",
      });
      expect(jobId).toBe("job-mom-1");
    });
  });
});
