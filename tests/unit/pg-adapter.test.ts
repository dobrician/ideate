import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/resource-monitor", () => ({
  updatePoolStats: vi.fn(),
}));

describe("PostgreSQL adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("pg.ts module", () => {
    it("throws when POSTGRESQL_URL is not set", async () => {
      delete process.env.POSTGRESQL_URL;
      delete process.env.DATABASE_URL;
      process.env.DATABASE_DRIVER = "postgresql";

      await expect(async () => {
        await import("@/db/pg");
      }).rejects.toThrow("POSTGRESQL_URL or DATABASE_URL must be set");

      delete process.env.DATABASE_DRIVER;
    });
  });

  describe("schema-pg.ts", () => {
    it("exports the same table names as schema.ts", async () => {
      const sqliteSchema = await import("@/db/schema");
      const pgSchema = await import("@/db/schema-pg");

      const sqliteExports = Object.keys(sqliteSchema).sort();
      const pgExports = Object.keys(pgSchema).sort();

      expect(pgExports).toEqual(sqliteExports);
    });

    it("all pg tables have the same column names as sqlite tables", async () => {
      const sqliteSchema = await import("@/db/schema");
      const pgSchema = await import("@/db/schema-pg");

      for (const key of Object.keys(sqliteSchema)) {
        const sqliteTable = (sqliteSchema as Record<string, { _: { columns: Record<string, unknown> } }>)[key];
        const pgTable = (pgSchema as Record<string, { _: { columns: Record<string, unknown> } }>)[key];

        if (!sqliteTable?._ || !pgTable?._) continue;

        const sqliteCols = Object.keys(sqliteTable._.columns).sort();
        const pgCols = Object.keys(pgTable._.columns).sort();

        expect(pgCols, `Table ${key} column mismatch`).toEqual(sqliteCols);
      }
    });
  });
});

describe("drizzle.config.ts", () => {
  it("defaults to sqlite dialect", async () => {
    delete process.env.DATABASE_DRIVER;
    vi.resetModules();
    const config = await import("../../drizzle.config");
    expect(config.default.dialect).toBe("sqlite");
  });

  it("uses postgresql dialect when DATABASE_DRIVER=postgresql", async () => {
    process.env.DATABASE_DRIVER = "postgresql";
    vi.resetModules();
    const config = await import("../../drizzle.config");
    expect(config.default.dialect).toBe("postgresql");
    delete process.env.DATABASE_DRIVER;
  });
});
