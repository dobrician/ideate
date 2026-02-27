/**
 * Unit tests for CI build retention — pruning and retention stats.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue({ changes: 5 }),
});
const mockSelect = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
});

vi.mock("@/db", () => ({
  db: {
    delete: (...args: unknown[]) => mockDelete(...args),
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  ciBuilds: Symbol("ciBuilds"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  },
}));

import {
  getCiBuildRetentionDays,
  pruneCiBuilds,
  getCiBuildRetentionStats,
} from "@/lib/ci-builds";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CI_BUILD_RETENTION_DAYS;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CI Build Retention", () => {
  describe("getCiBuildRetentionDays", () => {
    it("returns default 90 when env not set", () => {
      expect(getCiBuildRetentionDays()).toBe(90);
    });

    it("returns env value when valid", () => {
      process.env.CI_BUILD_RETENTION_DAYS = "60";
      expect(getCiBuildRetentionDays()).toBe(60);
    });

    it("returns default for invalid env", () => {
      process.env.CI_BUILD_RETENTION_DAYS = "abc";
      expect(getCiBuildRetentionDays()).toBe(90);
    });

    it("returns default for zero", () => {
      process.env.CI_BUILD_RETENTION_DAYS = "0";
      expect(getCiBuildRetentionDays()).toBe(90);
    });

    it("returns default for negative", () => {
      process.env.CI_BUILD_RETENTION_DAYS = "-10";
      expect(getCiBuildRetentionDays()).toBe(90);
    });
  });

  describe("pruneCiBuilds", () => {
    it("deletes old builds and returns count", async () => {
      const deleted = await pruneCiBuilds(90);
      expect(deleted).toBe(5);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("uses env retention days when no argument", async () => {
      process.env.CI_BUILD_RETENTION_DAYS = "30";
      await pruneCiBuilds();
      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns 0 when no records deleted", async () => {
      mockDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ changes: 0 }),
      });
      const deleted = await pruneCiBuilds(90);
      expect(deleted).toBe(0);
    });

    it("handles undefined changes property", async () => {
      mockDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });
      const deleted = await pruneCiBuilds(90);
      expect(deleted).toBe(0);
    });
  });

  describe("getCiBuildRetentionStats", () => {
    it("returns stats with total and oldest", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      mockSelect.mockReturnValue({
        from: () => Promise.resolve([{
          total: 42,
          oldest: nowSec - 30 * 86400,
        }]),
      });

      const stats = await getCiBuildRetentionStats();
      expect(stats.totalRecords).toBe(42);
      expect(stats.oldestDaysAgo).toBe(30);
      expect(stats.retentionDays).toBe(90);
    });

    it("returns zero stats for empty table", async () => {
      mockSelect.mockReturnValue({
        from: () => Promise.resolve([{
          total: 0,
          oldest: null,
        }]),
      });

      const stats = await getCiBuildRetentionStats();
      expect(stats.totalRecords).toBe(0);
      expect(stats.oldestDaysAgo).toBe(0);
    });
  });
});
