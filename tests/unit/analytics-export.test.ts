import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before import
vi.mock("@/lib/search/analytics", () => ({
  getSearchStats: vi.fn(),
  getPopularSearches: vi.fn(),
  getZeroResultSearches: vi.fn(),
}));
vi.mock("@/lib/search/quality", () => ({
  getSearchQualityStats: vi.fn(),
  getSearchFeedbackTrend: vi.fn(),
  getLowRatedResults: vi.fn(),
}));
vi.mock("@/lib/ci-builds", () => ({
  getRecentCiBuilds: vi.fn(),
  getCiBuildStats: vi.fn(),
}));
vi.mock("@/lib/bundle-tracker", () => ({
  getBundleSizeAnalytics: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { exportSearchAnalyticsCsv, exportCiBuildsCsv } from "@/lib/analytics-export";
import { getSearchStats, getPopularSearches, getZeroResultSearches } from "@/lib/search/analytics";
import { getSearchQualityStats, getSearchFeedbackTrend, getLowRatedResults } from "@/lib/search/quality";
import { getRecentCiBuilds, getCiBuildStats } from "@/lib/ci-builds";
import { getBundleSizeAnalytics } from "@/lib/bundle-tracker";

describe("analytics-export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportSearchAnalyticsCsv", () => {
    it("generates CSV with all sections", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 150,
        uniqueQueries: 80,
        avgResponseTime: 42,
        zeroResultRate: 5.2,
        clickThroughRate: 32.5,
        searchesByMode: { fts: 100, semantic: 50 },
      });
      vi.mocked(getPopularSearches).mockResolvedValue([
        { query: "test query", count: 15, avgResults: 3 },
      ]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([
        { query: "missing", count: 5, lastSearched: Date.now() },
      ]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({
        totalFeedback: 20,
        positiveRate: 75,
        byMode: { fts: { positive: 10, negative: 5, total: 15 } },
      });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([
        { date: "2026-02-27", positive: 5, negative: 2, total: 7 },
      ]);
      vi.mocked(getLowRatedResults).mockResolvedValue([
        { resultId: "abc-123", resultType: "project", negativeCount: 3, positiveCount: 1, query: "bad result" },
      ]);

      const csv = await exportSearchAnalyticsCsv(30);

      expect(csv).toContain("# Search Analytics Summary");
      expect(csv).toContain("Total Searches,150");
      expect(csv).toContain("Unique Queries,80");
      expect(csv).toContain("# Popular Searches");
      expect(csv).toContain("test query,15,3");
      expect(csv).toContain("# Zero-Result Searches");
      expect(csv).toContain("missing,5");
      expect(csv).toContain("# Quality Feedback by Mode");
      expect(csv).toContain("fts,10,5,15");
      expect(csv).toContain("# Daily Feedback Trend");
      expect(csv).toContain("2026-02-27,5,2,7");
      expect(csv).toContain("# Low-Rated Results");
      expect(csv).toContain("bad result,abc-123,project,3,1");
    });

    it("handles empty data gracefully", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 0,
        uniqueQueries: 0,
        avgResponseTime: 0,
        zeroResultRate: 0,
        clickThroughRate: 0,
        searchesByMode: {},
      });
      vi.mocked(getPopularSearches).mockResolvedValue([]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({
        totalFeedback: 0,
        positiveRate: 0,
        byMode: {},
      });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      const csv = await exportSearchAnalyticsCsv(30);

      expect(csv).toContain("# Search Analytics Summary");
      expect(csv).toContain("Total Searches,0");
    });

    it("escapes CSV fields with commas and quotes", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 1,
        uniqueQueries: 1,
        avgResponseTime: 10,
        zeroResultRate: 0,
        clickThroughRate: 0,
        searchesByMode: {},
      });
      vi.mocked(getPopularSearches).mockResolvedValue([
        { query: 'search "with quotes", and commas', count: 1, avgResults: 1 },
      ]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({
        totalFeedback: 0,
        positiveRate: 0,
        byMode: {},
      });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      const csv = await exportSearchAnalyticsCsv(30);

      // Field with commas and quotes should be wrapped and escaped
      expect(csv).toContain('"search ""with quotes"", and commas"');
    });

    it("passes daysBack parameter to all functions", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 0, uniqueQueries: 0, avgResponseTime: 0,
        zeroResultRate: 0, clickThroughRate: 0, searchesByMode: {},
      });
      vi.mocked(getPopularSearches).mockResolvedValue([]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({
        totalFeedback: 0, positiveRate: 0, byMode: {},
      });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      await exportSearchAnalyticsCsv(60);

      expect(getSearchStats).toHaveBeenCalledWith(60);
      expect(getPopularSearches).toHaveBeenCalledWith(50, 60);
      expect(getZeroResultSearches).toHaveBeenCalledWith(50, 60);
      expect(getSearchQualityStats).toHaveBeenCalledWith(60);
      expect(getSearchFeedbackTrend).toHaveBeenCalledWith(60);
      expect(getLowRatedResults).toHaveBeenCalledWith(50, 60);
    });

    it("includes export filter section in CSV", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 10, uniqueQueries: 5, avgResponseTime: 20,
        zeroResultRate: 0, clickThroughRate: 50, searchesByMode: { fts: 10 },
      });
      vi.mocked(getPopularSearches).mockResolvedValue([]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({ totalFeedback: 0, positiveRate: 0, byMode: {} });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      const csv = await exportSearchAnalyticsCsv({
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        mode: "fts",
      });

      expect(csv).toContain("# Export Filters");
      expect(csv).toContain("Start Date,2026-03-01");
      expect(csv).toContain("End Date,2026-03-05");
      expect(csv).toContain("Mode Filter,fts");
    });

    it("computes daysBack from startDate/endDate", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 0, uniqueQueries: 0, avgResponseTime: 0,
        zeroResultRate: 0, clickThroughRate: 0, searchesByMode: {},
      });
      vi.mocked(getPopularSearches).mockResolvedValue([]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({ totalFeedback: 0, positiveRate: 0, byMode: {} });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      await exportSearchAnalyticsCsv({
        startDate: "2026-02-25",
        endDate: "2026-03-05",
      });

      // 8 days between start and end
      expect(getSearchStats).toHaveBeenCalledWith(8);
    });

    it("filters searchesByMode when mode filter is set", async () => {
      vi.mocked(getSearchStats).mockResolvedValue({
        totalSearches: 200, uniqueQueries: 100, avgResponseTime: 30,
        zeroResultRate: 2, clickThroughRate: 40,
        searchesByMode: { fts: 100, semantic: 80, hybrid: 20 },
      });
      vi.mocked(getPopularSearches).mockResolvedValue([]);
      vi.mocked(getZeroResultSearches).mockResolvedValue([]);
      vi.mocked(getSearchQualityStats).mockResolvedValue({
        totalFeedback: 10, positiveRate: 80,
        byMode: { fts: { positive: 5, negative: 1, total: 6 }, semantic: { positive: 3, negative: 1, total: 4 } },
      });
      vi.mocked(getSearchFeedbackTrend).mockResolvedValue([]);
      vi.mocked(getLowRatedResults).mockResolvedValue([]);

      const csv = await exportSearchAnalyticsCsv({ mode: "fts" });

      expect(csv).toContain("Searches (fts),100");
      expect(csv).not.toContain("Searches (semantic)");
      expect(csv).not.toContain("Searches (hybrid)");
      // Quality section should also be filtered
      expect(csv).toContain("fts,5,1,6");
      expect(csv).not.toContain("semantic,3,1,4");
    });
  });

  describe("exportCiBuildsCsv", () => {
    it("generates CSV with stats and builds", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([
        {
          id: "1",
          commitHash: "abc123",
          branch: "main",
          durationMs: 60000,
          buildSizeBytes: 700000000,
          status: "success",
          runId: "run-1",
          createdAt: new Date("2026-02-27T10:00:00Z"),
        },
      ]);
      vi.mocked(getCiBuildStats).mockResolvedValue({
        count: 1,
        avgDurationMs: 60000,
        minDurationMs: 60000,
        maxDurationMs: 60000,
        latestDurationMs: 60000,
        trend: "stable",
      });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({
        current: { commitHash: "abc123", branch: "main", sizeBytes: 700000000, durationMs: 60000, createdAt: new Date() },
        trend: "stable" as const,
        avgSizeBytes: 700000000,
        minSizeBytes: 700000000,
        maxSizeBytes: 700000000,
        budgetStatus: "ok" as const,
        recentEntries: [],
      });

      const csv = await exportCiBuildsCsv(50);

      expect(csv).toContain("# CI Build Stats Summary");
      expect(csv).toContain("Total Builds,1");
      expect(csv).toContain("Avg Duration (ms),60000");
      expect(csv).toContain("Trend,stable");
      expect(csv).toContain("# Recent CI Builds");
      expect(csv).toContain("abc123,main,60000");
    });

    it("handles empty builds", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([]);
      vi.mocked(getCiBuildStats).mockResolvedValue({
        count: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        latestDurationMs: null,
        trend: "insufficient",
      });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({
        current: null,
        trend: "stable" as const,
        avgSizeBytes: null,
        minSizeBytes: null,
        maxSizeBytes: null,
        budgetStatus: "ok" as const,
        recentEntries: [],
      });

      const csv = await exportCiBuildsCsv(50);

      expect(csv).toContain("Total Builds,0");
      expect(csv).toContain("Trend,insufficient");
    });

    it("handles null bundle size", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([
        {
          id: "1",
          commitHash: "def456",
          branch: "feature",
          durationMs: 30000,
          buildSizeBytes: null,
          status: "success",
          runId: null,
          createdAt: null,
        },
      ]);
      vi.mocked(getCiBuildStats).mockResolvedValue({
        count: 1,
        avgDurationMs: 30000,
        minDurationMs: 30000,
        maxDurationMs: 30000,
        latestDurationMs: 30000,
        trend: "insufficient",
      });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({
        current: null,
        trend: "stable" as const,
        avgSizeBytes: null,
        minSizeBytes: null,
        maxSizeBytes: null,
        budgetStatus: "ok" as const,
        recentEntries: [],
      });

      const csv = await exportCiBuildsCsv(50);

      expect(csv).toContain("def456,feature,30000");
      expect(csv).toContain("Current Bundle Size (MB),N/A");
    });

    it("filters builds by branch", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([
        { id: "1", commitHash: "a1", branch: "main", durationMs: 50000, buildSizeBytes: null, status: "success", runId: null, createdAt: new Date("2026-03-01") },
        { id: "2", commitHash: "b2", branch: "feature", durationMs: 40000, buildSizeBytes: null, status: "success", runId: null, createdAt: new Date("2026-03-02") },
        { id: "3", commitHash: "c3", branch: "main", durationMs: 55000, buildSizeBytes: null, status: "failure", runId: null, createdAt: new Date("2026-03-03") },
      ]);
      vi.mocked(getCiBuildStats).mockResolvedValue({ count: 3, avgDurationMs: 48333, minDurationMs: 40000, maxDurationMs: 55000, latestDurationMs: 55000, trend: "stable" });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({ current: null, trend: "stable" as const, avgSizeBytes: null, minSizeBytes: null, maxSizeBytes: null, budgetStatus: "ok" as const, recentEntries: [] });

      const csv = await exportCiBuildsCsv({ branch: "main" });

      expect(csv).toContain("Branch,main");
      expect(csv).toContain("a1,main,50000");
      expect(csv).toContain("c3,main,55000");
      expect(csv).not.toContain("b2,feature");
    });

    it("filters builds by date range", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([
        { id: "1", commitHash: "a1", branch: "main", durationMs: 50000, buildSizeBytes: null, status: "success", runId: null, createdAt: new Date("2026-02-28") },
        { id: "2", commitHash: "b2", branch: "main", durationMs: 40000, buildSizeBytes: null, status: "success", runId: null, createdAt: new Date("2026-03-02") },
        { id: "3", commitHash: "c3", branch: "main", durationMs: 55000, buildSizeBytes: null, status: "success", runId: null, createdAt: new Date("2026-03-04") },
      ]);
      vi.mocked(getCiBuildStats).mockResolvedValue({ count: 3, avgDurationMs: 48333, minDurationMs: 40000, maxDurationMs: 55000, latestDurationMs: 55000, trend: "stable" });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({ current: null, trend: "stable" as const, avgSizeBytes: null, minSizeBytes: null, maxSizeBytes: null, budgetStatus: "ok" as const, recentEntries: [] });

      const csv = await exportCiBuildsCsv({ startDate: "2026-03-01", endDate: "2026-03-03" });

      expect(csv).toContain("Start Date,2026-03-01");
      expect(csv).toContain("End Date,2026-03-03");
      expect(csv).toContain("b2,main,40000");
      expect(csv).not.toContain("a1,main,50000"); // before startDate
      expect(csv).not.toContain("c3,main,55000"); // after endDate
    });

    it("includes filter section in CSV output", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([]);
      vi.mocked(getCiBuildStats).mockResolvedValue({ count: 0, avgDurationMs: 0, minDurationMs: 0, maxDurationMs: 0, latestDurationMs: null, trend: "insufficient" });
      vi.mocked(getBundleSizeAnalytics).mockResolvedValue({ current: null, trend: "stable" as const, avgSizeBytes: null, minSizeBytes: null, maxSizeBytes: null, budgetStatus: "ok" as const, recentEntries: [] });

      const csv = await exportCiBuildsCsv({ limit: 100, branch: "develop" });

      expect(csv).toContain("# Export Filters");
      expect(csv).toContain("Limit,100");
      expect(csv).toContain("Branch,develop");
    });
  });
});
