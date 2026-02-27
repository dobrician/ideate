import { describe, it, expect, vi, beforeEach } from "vitest";

let queryResults: unknown[][] = [];
let queryIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(queryResults[queryIndex++] ?? []),
          }),
        }),
        groupBy: () => ({
          orderBy: () => Promise.resolve(queryResults[queryIndex++] ?? []),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  ciBuilds: {
    branch: "branch",
    createdAt: "createdAt",
    commitHash: "commitHash",
    durationMs: "durationMs",
    buildSizeBytes: "buildSizeBytes",
    status: "status",
    runId: "runId",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { getBranchBuildStats, compareBranches, getAvailableBranches } from "@/lib/ci-build-comparison";

describe("ci-build-comparison", () => {
  beforeEach(() => {
    queryResults = [];
    queryIndex = 0;
  });

  describe("getBranchBuildStats", () => {
    it("returns empty stats for no builds", async () => {
      queryResults = [[]];
      const stats = await getBranchBuildStats("main");

      expect(stats.branch).toBe("main");
      expect(stats.buildCount).toBe(0);
      expect(stats.avgDurationMs).toBe(0);
      expect(stats.avgSizeBytes).toBeNull();
      expect(stats.successRate).toBe(0);
      expect(stats.latestDurationMs).toBeNull();
    });

    it("computes stats for multiple builds", async () => {
      queryResults = [
        [
          { id: "1", commitHash: "abc", branch: "main", durationMs: 60000, buildSizeBytes: 700000000, status: "success", runId: "r1", createdAt: new Date() },
          { id: "2", commitHash: "def", branch: "main", durationMs: 80000, buildSizeBytes: 710000000, status: "success", runId: "r2", createdAt: new Date() },
          { id: "3", commitHash: "ghi", branch: "main", durationMs: 90000, buildSizeBytes: null, status: "failure", runId: "r3", createdAt: new Date() },
        ],
      ];

      const stats = await getBranchBuildStats("main");

      expect(stats.branch).toBe("main");
      expect(stats.buildCount).toBe(3);
      expect(stats.avgDurationMs).toBe(76667); // (60000+80000+90000)/3 rounded
      expect(stats.avgSizeBytes).toBe(705000000); // (700M+710M)/2
      expect(stats.successRate).toBe(67); // 2/3
      expect(stats.latestDurationMs).toBe(60000);
      expect(stats.latestCommit).toBe("abc");
    });

    it("handles all null sizes", async () => {
      queryResults = [
        [
          { id: "1", commitHash: "abc", branch: "feature", durationMs: 50000, buildSizeBytes: null, status: "success", runId: null, createdAt: null },
        ],
      ];

      const stats = await getBranchBuildStats("feature");

      expect(stats.avgSizeBytes).toBeNull();
      expect(stats.latestSizeBytes).toBeNull();
    });
  });

  describe("compareBranches", () => {
    it("compares two branches", async () => {
      queryResults = [
        // Branch A (main)
        [
          { id: "1", commitHash: "abc", branch: "main", durationMs: 60000, buildSizeBytes: 700000000, status: "success", runId: "r1", createdAt: new Date() },
        ],
        // Branch B (feature)
        [
          { id: "2", commitHash: "def", branch: "feature", durationMs: 80000, buildSizeBytes: 750000000, status: "success", runId: "r2", createdAt: new Date() },
        ],
      ];

      const comparison = await compareBranches("main", "feature");

      expect(comparison.branchA.branch).toBe("main");
      expect(comparison.branchB.branch).toBe("feature");
      expect(comparison.durationDiffMs).toBe(-20000); // main is faster
      expect(comparison.durationDiffPct).toBe(-25); // 25% faster
      expect(comparison.sizeDiffBytes).toBe(-50000000); // main is smaller
      expect(comparison.sizeDiffPct).toBe(-7);
      expect(comparison.successRateDiff).toBe(0); // both 100%
    });

    it("handles empty branches", async () => {
      queryResults = [[], []];

      const comparison = await compareBranches("main", "nonexistent");

      expect(comparison.branchA.buildCount).toBe(0);
      expect(comparison.branchB.buildCount).toBe(0);
      expect(comparison.durationDiffMs).toBe(0);
      expect(comparison.durationDiffPct).toBe(0);
      expect(comparison.sizeDiffBytes).toBeNull();
    });

    it("handles one branch with no size data", async () => {
      queryResults = [
        [{ id: "1", commitHash: "a", branch: "main", durationMs: 50000, buildSizeBytes: 700000000, status: "success", runId: null, createdAt: null }],
        [{ id: "2", commitHash: "b", branch: "dev", durationMs: 60000, buildSizeBytes: null, status: "success", runId: null, createdAt: null }],
      ];

      const comparison = await compareBranches("main", "dev");

      expect(comparison.sizeDiffBytes).toBeNull();
      expect(comparison.sizeDiffPct).toBeNull();
    });

    it("computes positive percentage when branch A is slower", async () => {
      queryResults = [
        [{ id: "1", commitHash: "a", branch: "slow", durationMs: 120000, buildSizeBytes: null, status: "success", runId: null, createdAt: null }],
        [{ id: "2", commitHash: "b", branch: "fast", durationMs: 60000, buildSizeBytes: null, status: "success", runId: null, createdAt: null }],
      ];

      const comparison = await compareBranches("slow", "fast");

      expect(comparison.durationDiffMs).toBe(60000);
      expect(comparison.durationDiffPct).toBe(100); // 100% slower
    });
  });

  describe("getAvailableBranches", () => {
    it("returns branch list", async () => {
      queryResults = [
        [{ branch: "main" }, { branch: "develop" }, { branch: "feature" }],
      ];

      const branches = await getAvailableBranches();

      expect(branches).toEqual(["main", "develop", "feature"]);
    });

    it("returns empty for no builds", async () => {
      queryResults = [[]];

      const branches = await getAvailableBranches();

      expect(branches).toEqual([]);
    });
  });
});
