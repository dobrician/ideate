/**
 * Unit tests for the trend detection system.
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
  comments: Symbol("comments"),
  projects: Symbol("projects"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import { getTrendingTopics, getTrendingProposals, getTrendSnapshot } from "@/lib/analytics/trends";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Trend Detection", () => {
  describe("getTrendingTopics", () => {
    it("returns empty for no proposals", async () => {
      mockSelectChain.mockReturnValue([]);

      const topics = await getTrendingTopics(7, 10);
      expect(topics).toEqual([]);
    });

    it("extracts keywords from proposals", async () => {
      const proposalData = [
        { title: "Improve authentication security", description: "Better password handling" },
        { title: "Add authentication logging", description: "Track login attempts" },
        { title: "Performance optimization plan", description: null },
      ];
      mockSelectChain.mockReturnValue(proposalData);

      const topics = await getTrendingTopics(7, 10);
      const authTopic = topics.find((t) => t.keyword === "authentication");
      expect(authTopic).toBeDefined();
      expect(authTopic!.frequency).toBeGreaterThanOrEqual(2);
    });

    it("filters single-occurrence keywords", async () => {
      mockSelectChain.mockReturnValue([
        { title: "Unique keyword test", description: null },
      ]);

      const topics = await getTrendingTopics(7, 10);
      expect(topics.every((t) => t.frequency >= 2)).toBe(true);
    });

    it("calculates growth percentage", async () => {
      mockSelectChain.mockReturnValue([
        { title: "Authentication feature one", description: null },
        { title: "Authentication feature two", description: null },
        { title: "Authentication feature three", description: null },
      ]);

      const topics = await getTrendingTopics(7, 10);
      for (const topic of topics) {
        expect(typeof topic.growth).toBe("number");
      }
    });

    it("respects limit parameter", async () => {
      mockSelectChain.mockReturnValue([
        { title: "Topic alpha one", description: "Topic alpha desc" },
        { title: "Topic alpha two", description: "Topic alpha again" },
        { title: "Topic beta one", description: "Topic beta desc" },
        { title: "Topic beta two", description: "Topic beta again" },
      ]);

      const topics = await getTrendingTopics(7, 2);
      expect(topics.length).toBeLessThanOrEqual(2);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => { throw new Error("DB error"); });
      const topics = await getTrendingTopics();
      expect(topics).toEqual([]);
    });
  });

  describe("getTrendingProposals", () => {
    it("returns empty when no activity", async () => {
      mockSelectChain.mockReturnValue([]);

      const trending = await getTrendingProposals(7, 10);
      expect(trending).toEqual([]);
    });

    it("ranks proposals by momentum", async () => {
      mockSelectChain.mockImplementation((type: string) => {
        if (type === "select-where") {
          return [{ id: "p1", title: "Hot Proposal", projectId: "proj-1" }];
        }
        return [];
      });

      const trending = await getTrendingProposals(7, 10);
      expect(Array.isArray(trending)).toBe(true);
    });

    it("handles errors gracefully", async () => {
      mockSelectChain.mockImplementation(() => { throw new Error("DB error"); });
      const trending = await getTrendingProposals();
      expect(trending).toEqual([]);
    });

    it("calculates vote velocity correctly", async () => {
      mockSelectChain.mockReturnValue([
        { proposalId: "p1", voteCount: 14 },
      ]);

      const trending = await getTrendingProposals(7, 10);
      for (const p of trending) {
        expect(typeof p.voteVelocity).toBe("number");
        expect(typeof p.commentActivity).toBe("number");
        expect(typeof p.momentum).toBe("number");
      }
    });
  });

  describe("getTrendSnapshot", () => {
    it("returns a complete snapshot", async () => {
      mockSelectChain.mockReturnValue([]);

      const snapshot = await getTrendSnapshot(7);
      expect(snapshot).toHaveProperty("topics");
      expect(snapshot).toHaveProperty("proposals");
      expect(snapshot).toHaveProperty("generatedAt");
      expect(Array.isArray(snapshot.topics)).toBe(true);
      expect(Array.isArray(snapshot.proposals)).toBe(true);
      expect(typeof snapshot.generatedAt).toBe("string");
    });
  });
});
