import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import {
  trackStatement,
  getStatementCacheStats,
  clearStatementCache,
} from "@/lib/db/statement-cache";

describe("db/statement-cache", () => {
  beforeEach(() => {
    clearStatementCache();
  });

  describe("trackStatement", () => {
    it("tracks a new SQL statement", () => {
      trackStatement("SELECT * FROM projects WHERE id = ?");
      const stats = getStatementCacheStats();
      expect(stats.totalCached).toBe(1);
    });

    it("increments use count for repeated statements", () => {
      const sql = "SELECT * FROM projects WHERE id = ?";
      trackStatement(sql);
      trackStatement(sql);
      trackStatement(sql);

      const stats = getStatementCacheStats();
      expect(stats.totalCached).toBe(1);
      expect(stats.topStatements[0].useCount).toBe(3);
    });

    it("tracks multiple different statements", () => {
      trackStatement("SELECT * FROM projects");
      trackStatement("SELECT * FROM proposals");
      trackStatement("SELECT * FROM votes");

      const stats = getStatementCacheStats();
      expect(stats.totalCached).toBe(3);
    });
  });

  describe("getStatementCacheStats", () => {
    it("returns empty stats when no statements tracked", () => {
      const stats = getStatementCacheStats();
      expect(stats.totalCached).toBe(0);
      expect(stats.maxCapacity).toBe(200);
      expect(stats.topStatements).toEqual([]);
    });

    it("returns top statements sorted by use count", () => {
      trackStatement("SELECT a");
      trackStatement("SELECT b");
      trackStatement("SELECT b");
      trackStatement("SELECT c");
      trackStatement("SELECT c");
      trackStatement("SELECT c");

      const stats = getStatementCacheStats();
      expect(stats.topStatements[0].sql).toBe("SELECT c");
      expect(stats.topStatements[0].useCount).toBe(3);
      expect(stats.topStatements[1].sql).toBe("SELECT b");
      expect(stats.topStatements[1].useCount).toBe(2);
    });

    it("truncates long SQL statements", () => {
      const longSql = "SELECT " + "a".repeat(200) + " FROM test";
      trackStatement(longSql);

      const stats = getStatementCacheStats();
      expect(stats.topStatements[0].sql.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(stats.topStatements[0].sql).toContain("...");
    });

    it("limits top statements to 10", () => {
      for (let i = 0; i < 15; i++) {
        trackStatement(`SELECT ${i}`);
      }

      const stats = getStatementCacheStats();
      expect(stats.topStatements.length).toBe(10);
    });
  });

  describe("clearStatementCache", () => {
    it("clears all tracked statements", () => {
      trackStatement("SELECT 1");
      trackStatement("SELECT 2");
      clearStatementCache();

      const stats = getStatementCacheStats();
      expect(stats.totalCached).toBe(0);
    });
  });
});
