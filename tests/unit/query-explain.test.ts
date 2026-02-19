import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn();

vi.mock("@/db", () => ({
  db: { all: (...args: unknown[]) => mockAll(...args) },
}));

vi.mock("@/db/schema", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getQueryExplainPlans, listIndexes } from "@/lib/query-explain";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Query Explain", () => {
  describe("getQueryExplainPlans", () => {
    it("returns explain plans for common queries", () => {
      mockAll.mockReturnValue([
        { detail: "SEARCH projects USING INDEX idx_projects_deadline (deadline>?)" },
      ]);

      const plans = getQueryExplainPlans();
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].name).toBe("Projects by deadline");
      expect(plans[0].usesIndex).toBe(true);
      expect(plans[0].plan).toContain("SEARCH projects USING INDEX idx_projects_deadline (deadline>?)");
    });

    it("detects full table scans", () => {
      mockAll.mockReturnValue([{ detail: "SCAN proposals" }]);

      const plans = getQueryExplainPlans();
      expect(plans[0].usesIndex).toBe(false);
    });

    it("handles errors gracefully", () => {
      mockAll.mockImplementation(() => { throw new Error("DB error"); });

      const plans = getQueryExplainPlans();
      expect(plans.length).toBeGreaterThan(0);
      expect(plans[0].plan).toEqual(["Error: could not explain"]);
      expect(plans[0].usesIndex).toBe(false);
    });

    it("handles rows without detail field", () => {
      mockAll.mockReturnValue([{ id: 0, parent: 0, notused: 0, other: "SCAN table" }]);

      const plans = getQueryExplainPlans();
      expect(plans[0].plan.length).toBe(1);
    });
  });

  describe("listIndexes", () => {
    it("returns database indexes", () => {
      mockAll.mockReturnValue([
        { name: "idx_projects_deadline", tbl_name: "projects", sql: "CREATE INDEX idx_projects_deadline ON projects(deadline)" },
      ]);

      const indexes = listIndexes();
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe("idx_projects_deadline");
      expect(indexes[0].tableName).toBe("projects");
    });

    it("returns empty array on error", () => {
      mockAll.mockImplementation(() => { throw new Error("DB error"); });

      const indexes = listIndexes();
      expect(indexes).toEqual([]);
    });
  });
});
