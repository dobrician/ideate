/**
 * Unit tests for bundle size tracking — getPerfBudget, getBundleSizeHistory,
 * getBundleSizeAnalytics, checkBundleSizeRegression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRows: unknown[] = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([...mockRows]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  ciBuilds: { buildSizeBytes: Symbol("buildSizeBytes"), createdAt: Symbol("createdAt") },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getPerfBudget,
  getBundleSizeHistory,
  getBundleSizeAnalytics,
  checkBundleSizeRegression,
} from "@/lib/bundle-tracker";

beforeEach(() => {
  mockRows.length = 0;
  delete process.env.PERF_BUDGET_MAX_SIZE_BYTES;
  delete process.env.PERF_BUDGET_MAX_DURATION_MS;
  delete process.env.PERF_BUDGET_SIZE_REGRESSION_PCT;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(sizeBytes: number, durationMs = 30000): Record<string, unknown> {
  return {
    commitHash: "abc123",
    branch: "main",
    sizeBytes,
    durationMs,
    createdAt: new Date(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Bundle Tracker", () => {
  describe("getPerfBudget", () => {
    it("returns defaults when no env vars", () => {
      const budget = getPerfBudget();
      expect(budget.maxBuildSizeBytes).toBe(800 * 1024 * 1024);
      expect(budget.maxBuildDurationMs).toBe(120000);
      expect(budget.sizeRegressionThresholdPct).toBe(5);
    });

    it("uses env overrides", () => {
      process.env.PERF_BUDGET_MAX_SIZE_BYTES = "500000000";
      process.env.PERF_BUDGET_MAX_DURATION_MS = "60000";
      process.env.PERF_BUDGET_SIZE_REGRESSION_PCT = "3";
      const budget = getPerfBudget();
      expect(budget.maxBuildSizeBytes).toBe(500000000);
      expect(budget.maxBuildDurationMs).toBe(60000);
      expect(budget.sizeRegressionThresholdPct).toBe(3);
    });

    it("falls back to defaults for invalid env", () => {
      process.env.PERF_BUDGET_MAX_SIZE_BYTES = "invalid";
      const budget = getPerfBudget();
      expect(budget.maxBuildSizeBytes).toBe(800 * 1024 * 1024);
    });
  });

  describe("getBundleSizeHistory", () => {
    it("returns empty array when no data", async () => {
      const history = await getBundleSizeHistory();
      expect(history).toEqual([]);
    });

    it("returns mapped entries", async () => {
      mockRows.push(makeEntry(700 * 1024 * 1024));
      const history = await getBundleSizeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].sizeBytes).toBe(700 * 1024 * 1024);
    });
  });

  describe("getBundleSizeAnalytics", () => {
    it("returns empty analytics when no data", async () => {
      const analytics = await getBundleSizeAnalytics();
      expect(analytics.current).toBeNull();
      expect(analytics.trend).toBe("insufficient");
      expect(analytics.recentEntries).toBe(0);
    });

    it("returns analytics with single entry", async () => {
      mockRows.push(makeEntry(700 * 1024 * 1024));
      const analytics = await getBundleSizeAnalytics();
      expect(analytics.current!.sizeMb).toBe("700.0");
      expect(analytics.trend).toBe("insufficient");
      expect(analytics.budgetStatus.sizeWithinBudget).toBe(true);
    });

    it("detects growing trend", async () => {
      // Recent 5 larger, previous 5 smaller
      for (let i = 0; i < 5; i++) mockRows.push(makeEntry(750 * 1024 * 1024));
      for (let i = 0; i < 5; i++) mockRows.push(makeEntry(700 * 1024 * 1024));
      const analytics = await getBundleSizeAnalytics();
      expect(analytics.trend).toBe("growing");
    });

    it("detects stable trend", async () => {
      for (let i = 0; i < 10; i++) mockRows.push(makeEntry(700 * 1024 * 1024 + i * 100));
      const analytics = await getBundleSizeAnalytics();
      expect(analytics.trend).toBe("stable");
    });

    it("detects budget violation", async () => {
      mockRows.push(makeEntry(900 * 1024 * 1024)); // Over 800MB budget
      const analytics = await getBundleSizeAnalytics();
      expect(analytics.budgetStatus.sizeWithinBudget).toBe(false);
      expect(analytics.budgetStatus.sizeUsagePct).toBeGreaterThan(100);
    });
  });

  describe("checkBundleSizeRegression", () => {
    it("returns no regression with insufficient data", async () => {
      mockRows.push(makeEntry(700 * 1024 * 1024));
      const result = await checkBundleSizeRegression();
      expect(result.regression).toBe(false);
    });

    it("detects size regression above threshold", async () => {
      // Current is 10% bigger
      mockRows.push(makeEntry(770 * 1024 * 1024)); // current
      for (let i = 0; i < 5; i++) mockRows.push(makeEntry(700 * 1024 * 1024)); // baseline
      const result = await checkBundleSizeRegression();
      expect(result.regression).toBe(true);
      expect(result.message).toContain("regression");
      expect(result.changePct!).toBeGreaterThan(5);
    });

    it("no regression when within threshold", async () => {
      mockRows.push(makeEntry(710 * 1024 * 1024)); // 1.4% bigger
      for (let i = 0; i < 5; i++) mockRows.push(makeEntry(700 * 1024 * 1024));
      const result = await checkBundleSizeRegression();
      expect(result.regression).toBe(false);
    });
  });
});
