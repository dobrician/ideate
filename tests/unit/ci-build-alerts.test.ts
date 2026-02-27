/**
 * Unit tests for CI build alerting — checkCiBuildAlerts, getCiAlertThreshold, getCiBuildAlertSummary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectRows: unknown[] = [];

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve([...mockSelectRows]),
        }),
        where: () => Promise.resolve([{ total: 0, oldest: null }]),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve({ changes: 0 }),
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

import { getCiAlertThreshold, checkCiBuildAlerts } from "@/lib/ci-builds";

beforeEach(() => {
  mockSelectRows.length = 0;
  delete process.env.CI_ALERT_THRESHOLD;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBuild(durationMs: number, status = "success"): Record<string, unknown> {
  return {
    id: `build-${Math.random().toString(36).slice(2, 8)}`,
    commitHash: "abc123",
    branch: "main",
    durationMs,
    buildSizeBytes: null,
    status,
    runId: null,
    createdAt: new Date(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CI Build Alerting", () => {
  describe("getCiAlertThreshold", () => {
    it("returns default 3 when env not set", () => {
      expect(getCiAlertThreshold()).toBe(3);
    });

    it("returns env value when valid", () => {
      process.env.CI_ALERT_THRESHOLD = "5";
      expect(getCiAlertThreshold()).toBe(5);
    });

    it("returns default for invalid env", () => {
      process.env.CI_ALERT_THRESHOLD = "abc";
      expect(getCiAlertThreshold()).toBe(3);
    });

    it("returns default for value below 2", () => {
      process.env.CI_ALERT_THRESHOLD = "1";
      expect(getCiAlertThreshold()).toBe(3);
    });

    it("returns default for value above 20", () => {
      process.env.CI_ALERT_THRESHOLD = "25";
      expect(getCiAlertThreshold()).toBe(3);
    });

    it("accepts edge values", () => {
      process.env.CI_ALERT_THRESHOLD = "2";
      expect(getCiAlertThreshold()).toBe(2);

      process.env.CI_ALERT_THRESHOLD = "20";
      expect(getCiAlertThreshold()).toBe(20);
    });
  });

  describe("checkCiBuildAlerts", () => {
    it("returns no alert with insufficient data", async () => {
      // Less than threshold + 3 builds
      mockSelectRows.push(makeBuild(1000), makeBuild(1100));

      const result = await checkCiBuildAlerts();
      expect(result.alert).toBe(false);
      expect(result.type).toBeNull();
    });

    it("detects failure streak", async () => {
      // 3 failures + 8 successful baseline
      for (let i = 0; i < 3; i++) mockSelectRows.push(makeBuild(1000, "failure"));
      for (let i = 0; i < 8; i++) mockSelectRows.push(makeBuild(1000, "success"));

      const result = await checkCiBuildAlerts();
      expect(result.alert).toBe(true);
      expect(result.type).toBe("failure_streak");
      expect(result.message).toContain("consecutive build failures");
    });

    it("detects duration regression (>20% slower)", async () => {
      // 3 recent slow builds + 3 faster baseline
      for (let i = 0; i < 3; i++) mockSelectRows.push(makeBuild(2000));
      for (let i = 0; i < 5; i++) mockSelectRows.push(makeBuild(1000));
      for (let i = 0; i < 3; i++) mockSelectRows.push(makeBuild(1000));

      const result = await checkCiBuildAlerts();
      expect(result.alert).toBe(true);
      expect(result.type).toBe("regression");
      expect(result.message).toContain("slower than baseline");
    });

    it("returns no alert when builds are stable", async () => {
      // All builds around same duration
      for (let i = 0; i < 11; i++) mockSelectRows.push(makeBuild(1000 + (i % 3) * 10));

      const result = await checkCiBuildAlerts();
      expect(result.alert).toBe(false);
    });

    it("returns no alert when builds are improving", async () => {
      // Recent builds are faster
      for (let i = 0; i < 3; i++) mockSelectRows.push(makeBuild(800));
      for (let i = 0; i < 8; i++) mockSelectRows.push(makeBuild(1200));

      const result = await checkCiBuildAlerts();
      expect(result.alert).toBe(false);
    });
  });
});
