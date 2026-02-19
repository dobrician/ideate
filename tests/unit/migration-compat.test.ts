import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

describe("Database Migration Compatibility", () => {
  describe("SQLite migrations", () => {
    it("has a migration journal", () => {
      const journalPath = resolve("drizzle/meta/_journal.json");
      expect(existsSync(journalPath)).toBe(true);
    });

    it("all referenced migration files exist", () => {
      const journalPath = resolve("drizzle/meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

      for (const entry of journal.entries) {
        const sqlPath = resolve("drizzle", `${entry.tag}.sql`);
        expect(existsSync(sqlPath), `Missing migration: ${entry.tag}.sql`).toBe(true);
      }
    });

    it("migration files contain valid SQL", () => {
      const journalPath = resolve("drizzle/meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

      for (const entry of journal.entries) {
        const sqlPath = resolve("drizzle", `${entry.tag}.sql`);
        const content = readFileSync(sqlPath, "utf-8");
        expect(content.trim().length, `Empty migration: ${entry.tag}.sql`).toBeGreaterThan(0);
      }
    });
  });

  describe("PostgreSQL migrations", () => {
    it("has a migration journal", () => {
      const journalPath = resolve("drizzle-pg/meta/_journal.json");
      expect(existsSync(journalPath)).toBe(true);
    });

    it("all referenced migration files exist", () => {
      const journalPath = resolve("drizzle-pg/meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

      for (const entry of journal.entries) {
        const sqlPath = resolve("drizzle-pg", `${entry.tag}.sql`);
        expect(existsSync(sqlPath), `Missing migration: ${entry.tag}.sql`).toBe(true);
      }
    });

    it("initial migration creates all tables", () => {
      const journalPath = resolve("drizzle-pg/meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
      const firstEntry = journal.entries[0];
      const sqlPath = resolve("drizzle-pg", `${firstEntry.tag}.sql`);
      const content = readFileSync(sqlPath, "utf-8");

      const expectedTables = [
        "users", "projects", "proposals", "votes", "audit_logs",
        "invitations", "attachments", "notification_preferences",
        "comments", "tags", "project_tags", "proposal_tags",
        "webhooks", "webhook_deliveries", "oauth_accounts",
        "revoked_tokens", "llm_cache", "project_templates",
        "teams", "team_members", "job_queue", "cache_entries",
        "custom_roles",
      ];

      for (const table of expectedTables) {
        expect(content, `Missing CREATE TABLE for: ${table}`).toContain(`CREATE TABLE "${table}"`);
      }
    });

    it("uses PostgreSQL-specific syntax (timestamp, boolean)", () => {
      const journalPath = resolve("drizzle-pg/meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
      const firstEntry = journal.entries[0];
      const sqlPath = resolve("drizzle-pg", `${firstEntry.tag}.sql`);
      const content = readFileSync(sqlPath, "utf-8");

      // PostgreSQL uses timestamp and boolean types
      expect(content).toContain("timestamp");
      expect(content).toContain("boolean");
      // Should not contain SQLite-specific syntax
      expect(content).not.toContain("unixepoch");
    });
  });

  describe("Migration runner modules", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("pg migration runner exports applyPgMigrations", async () => {
      vi.mock("pg", () => ({ Pool: vi.fn() }));
      vi.mock("@/lib/logger", () => ({
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
      }));
      const mod = await import("@/db/migrate-pg");
      expect(typeof mod.applyPgMigrations).toBe("function");
    });

    it("adapter exports getDatabaseDriver and isPostgresql", async () => {
      const mod = await import("@/db/adapter");
      expect(typeof mod.getDatabaseDriver).toBe("function");
      expect(typeof mod.isPostgresql).toBe("function");
    });
  });

  describe("Schema parity", () => {
    it("both schemas export the same table names", async () => {
      const sqliteSchema = await import("@/db/schema");
      const pgSchema = await import("@/db/schema-pg");

      const sqliteExports = Object.keys(sqliteSchema).sort();
      const pgExports = Object.keys(pgSchema).sort();

      expect(pgExports).toEqual(sqliteExports);
    });
  });

  describe("drizzle.config.ts", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("uses drizzle/ output for sqlite", async () => {
      delete process.env.DATABASE_DRIVER;
      vi.resetModules();
      const config = (await import("../../drizzle.config")).default;
      expect(config.out).toBe("./drizzle");
    });

    it("uses drizzle-pg/ output for postgresql", async () => {
      process.env.DATABASE_DRIVER = "postgresql";
      vi.resetModules();
      const config = (await import("../../drizzle.config")).default;
      expect(config.out).toBe("./drizzle-pg");
      delete process.env.DATABASE_DRIVER;
    });
  });
});
