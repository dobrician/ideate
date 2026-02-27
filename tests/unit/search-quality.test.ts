/**
 * Unit tests for search quality — RRF tuning and feedback collection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  searchFeedback: Symbol("searchFeedback"),
  searchAnalytics: Symbol("searchAnalytics"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import { getRrfK, recordSearchFeedback, getSearchQualityStats, getSearchFeedbackTrend, getLowRatedResults } from "@/lib/search/quality";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SEARCH_RRF_K;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Search Quality", () => {
  describe("getRrfK", () => {
    it("returns default 60 when env not set", () => {
      expect(getRrfK()).toBe(60);
    });

    it("returns env value when valid", () => {
      process.env.SEARCH_RRF_K = "40";
      expect(getRrfK()).toBe(40);
    });

    it("returns default for invalid env value", () => {
      process.env.SEARCH_RRF_K = "abc";
      expect(getRrfK()).toBe(60);
    });

    it("returns default for zero", () => {
      process.env.SEARCH_RRF_K = "0";
      expect(getRrfK()).toBe(60);
    });

    it("returns default for values over 1000", () => {
      process.env.SEARCH_RRF_K = "1500";
      expect(getRrfK()).toBe(60);
    });

    it("accepts edge values", () => {
      process.env.SEARCH_RRF_K = "1";
      expect(getRrfK()).toBe(1);

      process.env.SEARCH_RRF_K = "1000";
      expect(getRrfK()).toBe(1000);
    });
  });

  describe("recordSearchFeedback", () => {
    it("inserts new feedback when no existing feedback", async () => {
      // Mock: no existing feedback
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      await recordSearchFeedback({
        userId: "user-1",
        analyticsId: "analytics-1",
        resultId: "result-1",
        resultType: "project",
        rating: 1,
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it("updates existing feedback", async () => {
      // Mock: existing feedback found
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "existing-1" }]),
          }),
        }),
      });

      await recordSearchFeedback({
        userId: "user-1",
        analyticsId: "analytics-1",
        resultId: "result-1",
        resultType: "project",
        rating: -1,
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it("handles errors gracefully", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error("db error")),
          }),
        }),
      });

      // Should not throw
      await expect(
        recordSearchFeedback({
          userId: "user-1",
          analyticsId: "analytics-1",
          resultId: "result-1",
          resultType: "project",
          rating: 1,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("getSearchQualityStats", () => {
    it("returns empty stats on error", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () => Promise.reject(new Error("db error")),
            }),
          }),
        }),
      });

      const stats = await getSearchQualityStats();
      expect(stats).toEqual({
        totalFeedback: 0,
        positiveRate: 0,
        byMode: {},
      });
    });

    it("computes stats from rows", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () =>
                Promise.resolve([
                  { mode: "fts", rating: 1, count: 10 },
                  { mode: "fts", rating: -1, count: 2 },
                  { mode: "hybrid", rating: 1, count: 5 },
                ]),
            }),
          }),
        }),
      });

      const stats = await getSearchQualityStats();
      expect(stats.totalFeedback).toBe(17);
      expect(stats.positiveRate).toBeCloseTo(88.24, 1);
      expect(stats.byMode.fts).toEqual({ positive: 10, negative: 2, total: 12 });
      expect(stats.byMode.hybrid).toEqual({ positive: 5, negative: 0, total: 5 });
    });
  });

  describe("getSearchFeedbackTrend", () => {
    it("returns empty array on error", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => Promise.reject(new Error("db error")),
            }),
          }),
        }),
      });

      const trend = await getSearchFeedbackTrend();
      expect(trend).toEqual([]);
    });

    it("aggregates daily feedback", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () =>
                Promise.resolve([
                  { date: "2026-02-25", rating: 1, count: 5 },
                  { date: "2026-02-25", rating: -1, count: 2 },
                  { date: "2026-02-26", rating: 1, count: 8 },
                ]),
            }),
          }),
        }),
      });

      const trend = await getSearchFeedbackTrend();
      expect(trend).toHaveLength(2);
      expect(trend[0]).toEqual({ date: "2026-02-25", positive: 5, negative: 2, total: 7 });
      expect(trend[1]).toEqual({ date: "2026-02-26", positive: 8, negative: 0, total: 8 });
    });

    it("handles single day with only negative", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () =>
                Promise.resolve([
                  { date: "2026-02-27", rating: -1, count: 3 },
                ]),
            }),
          }),
        }),
      });

      const trend = await getSearchFeedbackTrend();
      expect(trend).toHaveLength(1);
      expect(trend[0]).toEqual({ date: "2026-02-27", positive: 0, negative: 3, total: 3 });
    });

    it("returns empty array when no feedback exists", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const trend = await getSearchFeedbackTrend();
      expect(trend).toEqual([]);
    });
  });

  describe("getLowRatedResults", () => {
    it("returns empty array on error", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () => ({
                having: () => ({
                  orderBy: () => ({
                    limit: () => Promise.reject(new Error("db error")),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const results = await getLowRatedResults();
      expect(results).toEqual([]);
    });

    it("returns low-rated results sorted by negative count", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () => ({
                having: () => ({
                  orderBy: () => ({
                    limit: () =>
                      Promise.resolve([
                        { resultId: "proj-1", resultType: "project", negativeCount: 5, positiveCount: 1, query: "test query" },
                        { resultId: "prop-2", resultType: "proposal", negativeCount: 3, positiveCount: 2, query: "another search" },
                      ]),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const results = await getLowRatedResults();
      expect(results).toHaveLength(2);
      expect(results[0].resultId).toBe("proj-1");
      expect(results[0].negativeCount).toBe(5);
      expect(results[1].resultType).toBe("proposal");
    });

    it("respects limit parameter", async () => {
      mockSelect.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () => ({
                having: () => ({
                  orderBy: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const results = await getLowRatedResults(5, 7);
      expect(results).toEqual([]);
    });
  });
});
