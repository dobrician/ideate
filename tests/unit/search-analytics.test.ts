import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Track calls for assertions
const insertCalls: unknown[][] = [];
const insertValuesCalls: unknown[][] = [];
const updateCalls: unknown[][] = [];
const setCalls: unknown[][] = [];
const updateWhereCalls: unknown[][] = [];

// Queue of values for select() chains to resolve with
let selectQueue: Array<unknown> = [];

function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.groupBy = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => Promise.resolve(resolveValue);
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(onFulfilled, onRejected);
  return chain;
}

let insertShouldThrow = false;
let updateShouldThrow = false;
let selectShouldThrow = false;

vi.mock("@/db", () => {
  return {
    db: new Proxy({}, {
      get(_target, prop) {
        if (prop === "insert") {
          return (...args: unknown[]) => {
            if (insertShouldThrow) throw new Error("DB insert error");
            insertCalls.push(args);
            return {
              values: (...va: unknown[]) => {
                insertValuesCalls.push(va);
                return Promise.resolve();
              },
            };
          };
        }
        if (prop === "update") {
          return (...args: unknown[]) => {
            if (updateShouldThrow) throw new Error("DB update error");
            updateCalls.push(args);
            return {
              set: (...sa: unknown[]) => {
                setCalls.push(sa);
                return {
                  where: (...wa: unknown[]) => {
                    updateWhereCalls.push(wa);
                    return Promise.resolve();
                  },
                };
              },
            };
          };
        }
        if (prop === "select") {
          return (..._args: unknown[]) => {
            if (selectShouldThrow) throw new Error("DB select error");
            const val = selectQueue.shift() ?? [];
            return makeChain(val);
          };
        }
        return undefined;
      },
    }),
  };
});

vi.mock("@/db/schema", () => ({
  searchAnalytics: {
    id: "id",
    userId: "userId",
    query: "query",
    mode: "mode",
    filters: "filters",
    resultCount: "resultCount",
    responseTimeMs: "responseTimeMs",
    clickedResultId: "clickedResultId",
    clickedResultType: "clickedResultType",
    createdAt: "createdAt",
  },
  searchSuggestions: {
    id: "id",
    query: "query",
    frequency: "frequency",
    avgResults: "avgResults",
    lastSearchedAt: "lastSearchedAt",
  },
}));

vi.mock("drizzle-orm", () => {
  // sql is used both as a function and as a tagged template literal (sql`...`)
  // The result needs to have .as() for aliasing
  const sqlFn = (...args: unknown[]) => ({
    type: "sql",
    args,
    as: (name: string) => ({ type: "sql-as", name, args }),
    mapWith: () => ({ type: "sql", args, as: (name: string) => ({ type: "sql-as", name }) }),
  });
  return {
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: sqlFn,
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import {
  trackSearch,
  trackSearchClick,
  getPopularSearches,
  getZeroResultSearches,
  getSearchStats,
} from "@/lib/search/analytics";

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  insertCalls.length = 0;
  insertValuesCalls.length = 0;
  updateCalls.length = 0;
  setCalls.length = 0;
  updateWhereCalls.length = 0;
  selectQueue = [];
  insertShouldThrow = false;
  updateShouldThrow = false;
  selectShouldThrow = false;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search Analytics (search/analytics.ts)", () => {
  describe("trackSearch", () => {
    it("should insert an analytics record", async () => {
      selectQueue = [[]]; // for updateSuggestionFrequency

      await trackSearch({
        userId: "user-1",
        query: "react hooks",
        mode: "fts",
        resultCount: 10,
        responseTimeMs: 42,
      });

      expect(insertCalls.length).toBeGreaterThanOrEqual(1);
      expect(insertValuesCalls[0][0]).toMatchObject({
        id: "test-uuid-1234",
        userId: "user-1",
        query: "react hooks",
        mode: "fts",
        resultCount: 10,
        responseTimeMs: 42,
      });
    });

    it("should truncate query to 500 characters", async () => {
      const longQuery = "a".repeat(600);
      selectQueue = [[]];

      await trackSearch({
        userId: "user-1",
        query: longQuery,
        mode: "fts",
        resultCount: 0,
        responseTimeMs: 10,
      });

      expect(insertValuesCalls[0][0].query).toBe(longQuery.slice(0, 500));
    });

    it("should store JSON-serialized filters when provided", async () => {
      const filters = { dateFrom: "2025-01-01", tags: ["react"] };
      selectQueue = [[]];

      await trackSearch({
        userId: "user-1",
        query: "test",
        mode: "fts",
        filters,
        resultCount: 5,
        responseTimeMs: 30,
      });

      expect(insertValuesCalls[0][0].filters).toBe(JSON.stringify(filters));
    });

    it("should store null filters when not provided", async () => {
      selectQueue = [[]];

      await trackSearch({
        userId: "user-1",
        query: "test",
        mode: "fts",
        resultCount: 5,
        responseTimeMs: 30,
      });

      expect(insertValuesCalls[0][0].filters).toBeNull();
    });

    it("should insert new suggestion when none exists", async () => {
      selectQueue = [[]]; // empty = no existing suggestion

      await trackSearch({
        userId: "user-1",
        query: "React",
        mode: "fts",
        resultCount: 10,
        responseTimeMs: 42,
      });

      // 2 inserts: analytics + new suggestion
      expect(insertCalls).toHaveLength(2);
    });

    it("should update existing suggestion frequency", async () => {
      selectQueue = [
        [{ id: "sug-1", query: "react", frequency: 5, avgResults: 10 }],
      ];

      await trackSearch({
        userId: "user-1",
        query: "React",
        mode: "fts",
        resultCount: 20,
        responseTimeMs: 42,
      });

      expect(updateCalls).toHaveLength(1);
      expect(setCalls[0][0]).toMatchObject({ frequency: 6 });
    });

    it("should compute new average results when updating existing suggestion", async () => {
      selectQueue = [
        [{ id: "sug-1", query: "react", frequency: 5, avgResults: 10 }],
      ];

      await trackSearch({
        userId: "user-1",
        query: "React",
        mode: "fts",
        resultCount: 20,
        responseTimeMs: 42,
      });

      // newAvg = Math.round(((10 * 5) + 20) / 6) = Math.round(70/6) = 12
      expect(setCalls[0][0].avgResults).toBe(12);
    });

    it("should handle DB errors gracefully without throwing", async () => {
      insertShouldThrow = true;

      await expect(
        trackSearch({
          userId: "user-1",
          query: "test",
          mode: "fts",
          resultCount: 0,
          responseTimeMs: 10,
        })
      ).resolves.toBeUndefined();
    });

    it("should handle optional userId", async () => {
      selectQueue = [[]];

      await trackSearch({
        query: "anonymous search",
        mode: "fts",
        resultCount: 3,
        responseTimeMs: 15,
      });

      expect(insertValuesCalls[0][0].userId).toBeUndefined();
    });

    it("should skip suggestion update for very short queries", async () => {
      await trackSearch({
        userId: "user-1",
        query: "a",
        mode: "fts",
        resultCount: 0,
        responseTimeMs: 5,
      });

      // Only one insert for analytics, none for suggestions
      expect(insertCalls).toHaveLength(1);
    });
  });

  describe("trackSearchClick", () => {
    it("should update analytics record with click data", async () => {
      await trackSearchClick("analytics-1", "result-1", "project");

      expect(updateCalls).toHaveLength(1);
      expect(setCalls[0][0]).toEqual({
        clickedResultId: "result-1",
        clickedResultType: "project",
      });
      expect(updateWhereCalls).toHaveLength(1);
    });

    it("should accept proposal result type", async () => {
      await trackSearchClick("analytics-1", "result-1", "proposal");

      expect(setCalls[0][0]).toEqual({
        clickedResultId: "result-1",
        clickedResultType: "proposal",
      });
    });

    it("should accept comment result type", async () => {
      await trackSearchClick("analytics-1", "result-1", "comment");

      expect(setCalls[0][0]).toEqual({
        clickedResultId: "result-1",
        clickedResultType: "comment",
      });
    });

    it("should handle DB errors gracefully", async () => {
      updateShouldThrow = true;

      await expect(
        trackSearchClick("analytics-1", "result-1", "project")
      ).resolves.toBeUndefined();
    });
  });

  describe("getPopularSearches", () => {
    it("should return top queries by frequency", async () => {
      selectQueue = [
        [
          { query: "react", count: 100, avgResults: 15 },
          { query: "typescript", count: 80, avgResults: 12 },
        ],
      ];

      const results = await getPopularSearches();

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ query: "react", count: 100, avgResults: 15 });
      expect(results[1]).toEqual({ query: "typescript", count: 80, avgResults: 12 });
    });

    it("should return empty array when no popular searches", async () => {
      selectQueue = [[]];

      const results = await getPopularSearches();

      expect(results).toEqual([]);
    });

    it("should return empty array on DB error", async () => {
      selectShouldThrow = true;

      const results = await getPopularSearches();

      expect(results).toEqual([]);
    });
  });

  describe("getZeroResultSearches", () => {
    it("should return queries with zero results", async () => {
      selectQueue = [
        [{ query: "xyzabc", count: 5, lastSearched: 1700000000 }],
      ];

      const results = await getZeroResultSearches();

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ query: "xyzabc", count: 5, lastSearched: 1700000000 });
    });

    it("should return empty array when no zero-result queries", async () => {
      selectQueue = [[]];

      const results = await getZeroResultSearches();

      expect(results).toEqual([]);
    });

    it("should return empty array on DB error", async () => {
      selectShouldThrow = true;

      const results = await getZeroResultSearches();

      expect(results).toEqual([]);
    });
  });

  describe("getSearchStats", () => {
    it("should return correct aggregate stats", async () => {
      selectQueue = [
        // First select: main stats
        [{ total: 1000, unique: 200, avgTime: 50, zeroResults: 100, clicks: 300 }],
        // Second select: mode breakdown
        [
          { mode: "fts", count: 800 },
          { mode: "semantic", count: 200 },
        ],
      ];

      const stats = await getSearchStats();

      expect(stats).toEqual({
        totalSearches: 1000,
        uniqueQueries: 200,
        avgResponseTime: 50,
        zeroResultRate: 10,
        clickThroughRate: 30,
        searchesByMode: { fts: 800, semantic: 200 },
      });
    });

    it("should return default values on DB error", async () => {
      selectShouldThrow = true;

      const stats = await getSearchStats();

      expect(stats).toEqual({
        totalSearches: 0,
        uniqueQueries: 0,
        avgResponseTime: 0,
        zeroResultRate: 0,
        clickThroughRate: 0,
        searchesByMode: {},
      });
    });

    it("should handle zero total searches without division by zero", async () => {
      selectQueue = [
        [{ total: 0, unique: 0, avgTime: 0, zeroResults: 0, clicks: 0 }],
        [],
      ];

      const stats = await getSearchStats();

      expect(stats.zeroResultRate).toBe(0);
      expect(stats.clickThroughRate).toBe(0);
    });

    it("should handle null stats values", async () => {
      selectQueue = [
        [null],
        [],
      ];

      const stats = await getSearchStats();

      expect(stats.totalSearches).toBe(0);
      expect(stats.uniqueQueries).toBe(0);
    });

    it("should accept custom daysBack parameter", async () => {
      selectQueue = [
        [{ total: 50, unique: 10, avgTime: 25, zeroResults: 5, clicks: 20 }],
        [{ mode: "fts", count: 50 }],
      ];

      const stats = await getSearchStats(7);

      expect(stats).toBeDefined();
      expect(stats.totalSearches).toBe(50);
    });
  });
});
