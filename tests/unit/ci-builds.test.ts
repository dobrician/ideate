import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockSelectRows: unknown[] = [];

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: mockInsertValues }),
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(mockSelectRows),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  ciBuilds: { createdAt: Symbol("createdAt") },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

// ── Import SUT ─────────────────────────────────────────────────────────────

import { recordCiBuild, getCiBuildStats } from "@/lib/ci-builds";

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockInsertValues.mockClear();
  mockSelectRows.length = 0;
});

describe("ci-builds", () => {
  describe("recordCiBuild", () => {
    it("inserts a build record with all fields", async () => {
      await recordCiBuild({
        commitHash: "abc1234",
        branch: "main",
        durationMs: 45000,
        buildSizeBytes: 52428800,
        status: "success",
        runId: "run-123",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          commitHash: "abc1234",
          branch: "main",
          durationMs: 45000,
          buildSizeBytes: 52428800,
          status: "success",
          runId: "run-123",
        })
      );
    });

    it("uses defaults for optional fields", async () => {
      await recordCiBuild({
        commitHash: "def5678",
        durationMs: 30000,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          commitHash: "def5678",
          branch: "main",
          durationMs: 30000,
          buildSizeBytes: null,
          status: "success",
          runId: null,
        })
      );
    });
  });

  describe("getCiBuildStats", () => {
    it("returns insufficient trend when no builds", async () => {
      const stats = await getCiBuildStats();
      expect(stats.count).toBe(0);
      expect(stats.trend).toBe("insufficient");
      expect(stats.latestDurationMs).toBeNull();
    });

    it("calculates avg/min/max from builds", async () => {
      mockSelectRows.push(
        { id: "1", durationMs: 40000, status: "success" },
        { id: "2", durationMs: 50000, status: "success" },
        { id: "3", durationMs: 30000, status: "success" },
      );

      const stats = await getCiBuildStats();
      expect(stats.count).toBe(3);
      expect(stats.avgDurationMs).toBe(40000);
      expect(stats.minDurationMs).toBe(30000);
      expect(stats.maxDurationMs).toBe(50000);
      expect(stats.latestDurationMs).toBe(40000);
      expect(stats.trend).toBe("insufficient");
    });

    it("detects regressing trend", async () => {
      // Recent 5 builds are slower, previous 5 are faster
      for (let i = 0; i < 5; i++) {
        mockSelectRows.push({ id: `r${i}`, durationMs: 60000, status: "success" });
      }
      for (let i = 0; i < 5; i++) {
        mockSelectRows.push({ id: `p${i}`, durationMs: 40000, status: "success" });
      }

      const stats = await getCiBuildStats();
      expect(stats.trend).toBe("regressing");
    });

    it("detects improving trend", async () => {
      // Recent 5 builds are faster, previous 5 are slower
      for (let i = 0; i < 5; i++) {
        mockSelectRows.push({ id: `r${i}`, durationMs: 30000, status: "success" });
      }
      for (let i = 0; i < 5; i++) {
        mockSelectRows.push({ id: `p${i}`, durationMs: 50000, status: "success" });
      }

      const stats = await getCiBuildStats();
      expect(stats.trend).toBe("improving");
    });

    it("detects stable trend", async () => {
      // All builds similar duration
      for (let i = 0; i < 10; i++) {
        mockSelectRows.push({ id: `b${i}`, durationMs: 40000 + (i % 2) * 1000, status: "success" });
      }

      const stats = await getCiBuildStats();
      expect(stats.trend).toBe("stable");
    });
  });
});
