import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

// Hoist mock fns so they're available inside vi.mock factory
const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockConnect: vi.fn(),
}));

vi.mock("pg", () => {
  class MockPool {
    connect = mockConnect;
  }
  return { Pool: MockPool };
});

import { applyPgMigrations } from "@/db/migrate-pg";
import { Pool } from "pg";

beforeEach(() => {
  vi.clearAllMocks();
  mockConnect.mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  mockQuery.mockResolvedValue({ rows: [] });
});

describe("applyPgMigrations", () => {
  it("acquires advisory lock and creates _migrations table", async () => {
    const pool = new Pool();
    await applyPgMigrations(pool);

    expect(mockQuery).toHaveBeenCalledWith("SELECT pg_advisory_lock(42)");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS _migrations")
    );
    expect(mockQuery).toHaveBeenCalledWith("SELECT pg_advisory_unlock(42)");
    expect(mockRelease).toHaveBeenCalled();
  });

  it("skips already-applied migrations", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT 1 FROM _migrations")) {
        return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    });

    const pool = new Pool();
    await applyPgMigrations(pool);

    const beginCalls = mockQuery.mock.calls.filter((c) => c[0] === "BEGIN");
    expect(beginCalls).toHaveLength(0);
  });

  it("applies pending migrations with transaction", async () => {
    let migrationChecked = false;
    mockQuery.mockImplementation((sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT 1 FROM _migrations")) {
        if (!migrationChecked) {
          migrationChecked = true;
          return { rows: [] };
        }
        return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    });

    const pool = new Pool();
    await applyPgMigrations(pool);

    const beginCalls = mockQuery.mock.calls.filter((c) => c[0] === "BEGIN");
    const commitCalls = mockQuery.mock.calls.filter((c) => c[0] === "COMMIT");
    expect(beginCalls.length).toBeGreaterThanOrEqual(1);
    expect(commitCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("rolls back on non-idempotent error", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT 1 FROM _migrations")) {
        return { rows: [] };
      }
      if (typeof sql === "string" && sql.includes("CREATE TABLE") && !sql.includes("_migrations")) {
        throw new Error("syntax error near something");
      }
      return { rows: [] };
    });

    const pool = new Pool();
    await expect(applyPgMigrations(pool)).rejects.toThrow("syntax error");

    const rollbackCalls = mockQuery.mock.calls.filter((c) => c[0] === "ROLLBACK");
    expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("skips idempotent errors (already exists)", async () => {
    let migrationChecked = false;
    mockQuery.mockImplementation((sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT 1 FROM _migrations")) {
        if (!migrationChecked) {
          migrationChecked = true;
          return { rows: [] };
        }
        return { rows: [{}] };
      }
      if (typeof sql === "string" && sql.includes("CREATE TABLE") && !sql.includes("_migrations")) {
        throw new Error("relation already exists");
      }
      return { rows: [] };
    });

    const pool = new Pool();
    await applyPgMigrations(pool);
  });

  it("always releases advisory lock even on error", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql === "SELECT pg_advisory_lock(42)") return { rows: [] };
      if (sql.includes("_migrations") && sql.includes("CREATE TABLE IF NOT EXISTS")) {
        throw new Error("fatal pg error");
      }
      return { rows: [] };
    });

    const pool = new Pool();
    await expect(applyPgMigrations(pool)).rejects.toThrow("fatal pg error");

    expect(mockRelease).toHaveBeenCalled();
  });
});

describe("PostgreSQL migration files", () => {
  it("drizzle-pg journal references valid SQL files", () => {
    const journalPath = resolve("drizzle-pg/meta/_journal.json");
    expect(existsSync(journalPath)).toBe(true);

    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    for (const entry of journal.entries) {
      const sqlPath = resolve("drizzle-pg", `${entry.tag}.sql`);
      expect(existsSync(sqlPath), `Missing: ${entry.tag}.sql`).toBe(true);
      const content = readFileSync(sqlPath, "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });

  it("PG migration uses statement-breakpoint separators", () => {
    const journalPath = resolve("drizzle-pg/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const firstEntry = journal.entries[0];
    const content = readFileSync(
      resolve("drizzle-pg", `${firstEntry.tag}.sql`),
      "utf-8"
    );
    expect(content).toContain("--> statement-breakpoint");
  });
});
