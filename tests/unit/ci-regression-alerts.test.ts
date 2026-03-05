import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});
vi.mock("@/db/schema", () => ({
  ciRegressionAlerts: {
    id: "id", alertType: "alert_type", severity: "severity",
    message: "message", resolved: "resolved", createdAt: "created_at",
  },
}));
vi.mock("@/lib/ci-builds", () => ({
  getRecentCiBuilds: vi.fn(),
  getCiAlertThreshold: vi.fn().mockReturnValue(3),
}));
vi.mock("@/lib/ci-build-comparison", () => ({
  compareBranches: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { db } from "@/db";
import { getRecentCiBuilds } from "@/lib/ci-builds";
import { compareBranches } from "@/lib/ci-build-comparison";
import {
  detectAndPersistRegressions,
  detectBranchRegression,
  getRecentAlerts,
  getActiveAlerts,
  resolveAlert,
  getAlertStats,
  getDurationRegressionThreshold,
  getSizeRegressionThreshold,
} from "@/lib/ci-regression-alerts";

function mockBuild(overrides: Partial<{ id: string; commitHash: string; branch: string; durationMs: number; buildSizeBytes: number | null; status: string; runId: string | null; createdAt: Date | null }> = {}) {
  return {
    id: "b1",
    commitHash: "abc",
    branch: "main",
    durationMs: 60000,
    buildSizeBytes: null,
    status: "success",
    runId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("ci-regression-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CI_DURATION_REGRESSION_PCT;
    delete process.env.CI_SIZE_REGRESSION_PCT;
  });

  describe("threshold config", () => {
    it("returns default duration threshold of 20%", () => {
      expect(getDurationRegressionThreshold()).toBe(20);
    });

    it("respects CI_DURATION_REGRESSION_PCT env", () => {
      process.env.CI_DURATION_REGRESSION_PCT = "30";
      expect(getDurationRegressionThreshold()).toBe(30);
    });

    it("returns default size threshold of 10%", () => {
      expect(getSizeRegressionThreshold()).toBe(10);
    });

    it("respects CI_SIZE_REGRESSION_PCT env", () => {
      process.env.CI_SIZE_REGRESSION_PCT = "15";
      expect(getSizeRegressionThreshold()).toBe(15);
    });
  });

  describe("detectAndPersistRegressions", () => {
    it("returns empty when insufficient builds", async () => {
      vi.mocked(getRecentCiBuilds).mockResolvedValue([mockBuild(), mockBuild()]);

      const alerts = await detectAndPersistRegressions();
      expect(alerts).toEqual([]);
    });

    it("detects failure streak", async () => {
      const builds = Array.from({ length: 9 }, (_, i) =>
        mockBuild({
          id: `b${i}`,
          status: i < 3 ? "failure" : "success",
          durationMs: 60000,
        })
      );
      vi.mocked(getRecentCiBuilds).mockResolvedValue(builds);

      const mockAlert = {
        id: "alert-1", alertType: "failure_streak", severity: "critical",
        message: "3 consecutive build failures detected",
        branch: "main", avgRecentMs: null, avgBaselineMs: null,
        regressionPct: null, failureCount: 3, threshold: 3,
        resolved: false, resolvedAt: null, createdAt: new Date(),
      };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAlert]),
        }),
      } as never);

      const alerts = await detectAndPersistRegressions();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].alertType).toBe("failure_streak");
    });

    it("detects duration regression", async () => {
      const builds = [
        // Recent: 120s avg
        mockBuild({ id: "b1", durationMs: 120000 }),
        mockBuild({ id: "b2", durationMs: 120000 }),
        mockBuild({ id: "b3", durationMs: 120000 }),
        // Baseline: 60s avg (100% regression > 20% threshold)
        mockBuild({ id: "b4", durationMs: 60000 }),
        mockBuild({ id: "b5", durationMs: 60000 }),
        mockBuild({ id: "b6", durationMs: 60000 }),
        // Extra
        mockBuild({ id: "b7", durationMs: 60000 }),
        mockBuild({ id: "b8", durationMs: 60000 }),
        mockBuild({ id: "b9", durationMs: 60000 }),
      ];
      vi.mocked(getRecentCiBuilds).mockResolvedValue(builds);

      const mockAlert = {
        id: "alert-2", alertType: "regression", severity: "critical",
        message: "Builds are 100% slower", branch: "main",
        avgRecentMs: 120000, avgBaselineMs: 60000,
        regressionPct: 100, failureCount: null, threshold: 3,
        resolved: false, resolvedAt: null, createdAt: new Date(),
      };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAlert]),
        }),
      } as never);

      const alerts = await detectAndPersistRegressions();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some(a => a.alertType === "regression")).toBe(true);
    });

    it("returns empty on error", async () => {
      vi.mocked(getRecentCiBuilds).mockRejectedValue(new Error("DB down"));

      const alerts = await detectAndPersistRegressions();
      expect(alerts).toEqual([]);
    });
  });

  describe("detectBranchRegression", () => {
    it("returns null when branch matches base", async () => {
      const alert = await detectBranchRegression("main", "main");
      expect(alert).toBeNull();
    });

    it("detects branch slower than main", async () => {
      vi.mocked(compareBranches).mockResolvedValue({
        branchA: { branch: "feature", buildCount: 5, avgDurationMs: 90000, avgSizeBytes: null, successRate: 100, latestDurationMs: 90000, latestSizeBytes: null, latestStatus: "success", latestCommit: "abc" },
        branchB: { branch: "main", buildCount: 10, avgDurationMs: 60000, avgSizeBytes: null, successRate: 100, latestDurationMs: 60000, latestSizeBytes: null, latestStatus: "success", latestCommit: "def" },
        durationDiffMs: 30000,
        durationDiffPct: 50,
        sizeDiffBytes: null,
        sizeDiffPct: null,
        successRateDiff: 0,
      });

      const mockAlert = {
        id: "alert-3", alertType: "regression", severity: "critical",
        message: 'Branch "feature" is 50% slower than "main"',
        branch: "feature", avgRecentMs: 90000, avgBaselineMs: 60000,
        regressionPct: 50, failureCount: null, threshold: 3,
        resolved: false, resolvedAt: null, createdAt: new Date(),
      };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAlert]),
        }),
      } as never);

      const alert = await detectBranchRegression("feature");
      expect(alert).not.toBeNull();
      expect(alert!.branch).toBe("feature");
    });
  });

  describe("getRecentAlerts", () => {
    it("returns deserialized alerts", async () => {
      const mockRows = [{
        id: "a1", alertType: "regression", severity: "warning",
        message: "test", branch: "main", avgRecentMs: 100, avgBaselineMs: 80,
        regressionPct: 25, failureCount: null, threshold: 3,
        resolved: false, resolvedAt: null, createdAt: new Date(),
      }];
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      } as never);

      const alerts = await getRecentAlerts(10);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe("regression");
    });
  });

  describe("getAlertStats", () => {
    it("aggregates stats by type and resolution", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([
            { alertType: "regression", resolved: false, count: 3 },
            { alertType: "regression", resolved: true, count: 2 },
            { alertType: "failure_streak", resolved: false, count: 1 },
          ]),
        }),
      } as never);

      const stats = await getAlertStats();
      expect(stats.total).toBe(6);
      expect(stats.active).toBe(4);
      expect(stats.resolved).toBe(2);
      expect(stats.byType.regression).toBe(5);
      expect(stats.byType.failure_streak).toBe(1);
    });
  });

  describe("resolveAlert", () => {
    it("resolves alert by id", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ changes: 1 }),
        }),
      } as never);

      const result = await resolveAlert("alert-1");
      expect(result).toBe(true);
    });
  });
});
