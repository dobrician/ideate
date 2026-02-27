import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Sprint 64 FK index migration", () => {
  const migrationPath = resolve("drizzle/0033_sprint64_fk_indexes.sql");
  const sql = readFileSync(migrationPath, "utf-8");

  const expectedIndexes = [
    { name: "idx_teams_owner", table: "teams", column: "owner_id" },
    { name: "idx_webhook_deliveries_webhook", table: "webhook_deliveries", column: "webhook_id" },
    { name: "idx_proposal_workflow_state_stage", table: "proposal_workflow_state", column: "current_stage_id" },
    { name: "idx_permission_rules_created_by", table: "permission_rules", column: "created_by" },
    { name: "idx_resource_acls_granted_by", table: "resource_acls", column: "granted_by" },
    { name: "idx_ai_insights_dismissed_by", table: "ai_insights", column: "dismissed_by" },
    { name: "idx_integrations_created_by", table: "integrations", column: "created_by" },
  ];

  it("should contain all 7 FK index CREATE statements", () => {
    const createStatements = sql.match(/CREATE INDEX IF NOT EXISTS/g);
    expect(createStatements).toHaveLength(7);
  });

  for (const idx of expectedIndexes) {
    it(`should create index ${idx.name} on ${idx.table}(${idx.column})`, () => {
      const pattern = new RegExp(
        `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}\\(${idx.column}\\)`
      );
      expect(sql).toMatch(pattern);
    });
  }

  it("should use IF NOT EXISTS for idempotency", () => {
    const lines = sql.split("\n").filter((l) => l.startsWith("CREATE INDEX"));
    for (const line of lines) {
      expect(line).toContain("IF NOT EXISTS");
    }
  });

  it("should be registered in drizzle journal", () => {
    const journalPath = resolve("drizzle/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const entry = journal.entries.find(
      (e: { tag: string }) => e.tag === "0033_sprint64_fk_indexes"
    );
    expect(entry).toBeDefined();
    expect(entry.idx).toBe(33);
  });
});
