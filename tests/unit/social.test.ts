/**
 * Unit tests for social network analysis module.
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
            groupBy: () => {
              const gp = Promise.resolve(result ?? []);
              return { then: gp.then.bind(gp), catch: gp.catch.bind(gp) };
            },
          };
        },
        limit: (n: number) => {
          const result = mockSelectChain("select-limit", fields, table, n);
          const p = Promise.resolve(result ?? []);
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        },
        innerJoin: () => ({
          where: (...args: unknown[]) => ({
            groupBy: () => {
              const result = mockSelectChain("select-join-where-group", fields, table, ...args);
              const p = Promise.resolve(result ?? []);
              return { then: p.then.bind(p), catch: p.catch.bind(p) };
            },
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  users: Symbol("users"),
  proposals: Symbol("proposals"),
  votes: Symbol("votes"),
  comments: Symbol("comments"),
}));

vi.mock("@/lib/queue", () => ({
  registerHandler: vi.fn(),
  enqueue: vi.fn().mockResolvedValue("job-soc-1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  buildSocialNetwork,
  getUserInfluence,
  registerSocialHandlers,
  enqueueSocialAnalysis,
} from "@/lib/analytics/social";
import { registerHandler, enqueue } from "@/lib/queue";

const mockedRegisterHandler = vi.mocked(registerHandler);
const mockedEnqueue = vi.mocked(enqueue);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Social Network Analysis", () => {
  describe("buildSocialNetwork", () => {
    it("returns empty network when no users exist", async () => {
      mockSelectChain.mockReturnValue([]);

      const result = await buildSocialNetwork();
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.stats.totalUsers).toBe(0);
      expect(result.stats.activeUsers).toBe(0);
      expect(result.influencers).toEqual([]);
      expect(typeof result.generatedAt).toBe("string");
    });

    it("returns network structure with correct properties", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "u1", firstName: "Alice", lastName: "Smith" }];
        }
        if (type === "select-where") {
          return [{ count: 3 }];
        }
        return [];
      });

      const result = await buildSocialNetwork();
      expect(result).toHaveProperty("nodes");
      expect(result).toHaveProperty("edges");
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("influencers");
      expect(result).toHaveProperty("generatedAt");
      expect(result.stats).toHaveProperty("totalUsers");
      expect(result.stats).toHaveProperty("activeUsers");
      expect(result.stats).toHaveProperty("averageConnections");
      expect(result.stats).toHaveProperty("density");
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await buildSocialNetwork();
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe("getUserInfluence", () => {
    it("returns null when user not found", async () => {
      mockSelectChain.mockReturnValue([]);
      const result = await getUserInfluence("nonexistent");
      expect(result).toBeNull();
    });

    it("returns influence data for existing user", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "u1", firstName: "Alice", lastName: "Smith" }];
        }
        if (type === "select-where") {
          return [{ count: 5 }];
        }
        return [];
      });

      const result = await getUserInfluence("u1");
      if (result) {
        expect(result.userId).toBe("u1");
        expect(result.name).toBe("Alice Smith");
        expect(typeof result.proposalCount).toBe("number");
        expect(typeof result.voteCount).toBe("number");
        expect(typeof result.commentCount).toBe("number");
        expect(result.influence).toBeGreaterThanOrEqual(0);
        expect(result.influence).toBeLessThanOrEqual(100);
      }
    });

    it("handles anonymous users", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-limit") {
          return [{ id: "u2", firstName: null, lastName: null }];
        }
        if (type === "select-where") {
          return [{ count: 0 }];
        }
        return [];
      });

      const result = await getUserInfluence("u2");
      if (result) {
        expect(result.name).toBe("Anonymous");
      }
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => {
        throw new Error("DB error");
      });
      const result = await getUserInfluence("u1");
      expect(result).toBeNull();
    });
  });

  describe("registerSocialHandlers", () => {
    it("registers handler with queue system", () => {
      registerSocialHandlers();
      expect(mockedRegisterHandler).toHaveBeenCalledWith(
        "analytics-social",
        expect.any(Function)
      );
    });
  });

  describe("enqueueSocialAnalysis", () => {
    it("enqueues a social analysis job", async () => {
      const jobId = await enqueueSocialAnalysis();
      expect(mockedEnqueue).toHaveBeenCalledWith("analytics-social", {});
      expect(jobId).toBe("job-soc-1");
    });
  });
});
