import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAll = vi.fn();

vi.mock("@/db", () => ({
  db: { all: (...args: unknown[]) => mockAll(...args) },
}));

vi.mock("@/db/schema", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getQueryExplainPlans, getQueryExplainSummary, listIndexes } from "@/lib/query-explain";

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

  describe("FK join queries", () => {
    it("includes FK queries for proposals by projectId", () => {
      mockAll.mockReturnValue([
        { detail: "SEARCH proposals USING INDEX idx_proposals_project_id (project_id=?)" },
      ]);
      const plans = getQueryExplainPlans();
      const fkQuery = plans.find((p) => p.name === "Proposals by projectId (FK)");
      expect(fkQuery).toBeDefined();
      expect(fkQuery!.query).toContain("project_id");
    });

    it("includes FK queries for votes by proposalId", () => {
      mockAll.mockReturnValue([{ detail: "SEARCH votes USING INDEX idx_votes_proposal_id (proposal_id=?)" }]);
      const plans = getQueryExplainPlans();
      const fkQuery = plans.find((p) => p.name === "Votes by proposalId (FK)");
      expect(fkQuery).toBeDefined();
    });

    it("includes FK queries for teams by ownerId", () => {
      mockAll.mockReturnValue([{ detail: "SEARCH teams USING INDEX idx_teams_owner_id (owner_id=?)" }]);
      const plans = getQueryExplainPlans();
      const fkQuery = plans.find((p) => p.name === "Teams by ownerId (FK)");
      expect(fkQuery).toBeDefined();
    });

    it("includes FK queries for webhook deliveries", () => {
      mockAll.mockReturnValue([{ detail: "SEARCH webhook_deliveries USING INDEX idx_webhook_deliveries_webhook_id" }]);
      const plans = getQueryExplainPlans();
      const fkQuery = plans.find((p) => p.name === "Webhook deliveries by webhookId (FK)");
      expect(fkQuery).toBeDefined();
    });

    it("covers at least 16 total queries", () => {
      mockAll.mockReturnValue([{ detail: "SCAN table" }]);
      const plans = getQueryExplainPlans();
      expect(plans.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe("getQueryExplainSummary", () => {
    it("returns correct counts for all indexed queries", () => {
      mockAll.mockReturnValue([{ detail: "SEARCH t USING INDEX idx_foo (col=?)" }]);
      const summary = getQueryExplainSummary();
      expect(summary.total).toBeGreaterThanOrEqual(16);
      expect(summary.indexed).toBe(summary.total);
      expect(summary.fullScan).toBe(0);
    });

    it("returns correct counts for mixed results", () => {
      let callCount = 0;
      mockAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [{ detail: "SCAN table" }];
        return [{ detail: "SEARCH t USING INDEX idx_foo (col=?)" }];
      });
      const summary = getQueryExplainSummary();
      expect(summary.fullScan).toBe(1);
      expect(summary.indexed).toBe(summary.total - 1);
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
