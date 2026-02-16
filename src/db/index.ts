import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { logger } from "@/lib/logger";

const DB_PATH = process.env.DATABASE_URL ?? resolve("data/ideate.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

// Auto-apply pending migrations
function applyMigrations(): void {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT (unixepoch()))"
  );

  const migrationDir = resolve(
    process.env.NODE_ENV === "production" ? "drizzle" : "drizzle"
  );

  const migrations = [
    "0000_secret_kree.sql",
    "0001_sprint5_audit_search.sql",
    "0002_sprint7_indexes.sql",
    "0003_sprint9_password_auth.sql",
    "0004_sprint13_indexes.sql",
  ];

  for (const file of migrations) {
    const applied = sqlite
      .prepare("SELECT 1 FROM _migrations WHERE name = ?")
      .get(file);
    if (applied) continue;

    const filePath = resolve(migrationDir, file);
    if (!existsSync(filePath)) continue;

    const sql = readFileSync(filePath, "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      sqlite.exec(stmt);
    }

    sqlite.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  }
}

try {
  applyMigrations();
} catch (error) {
  logger.fatal({ err: error }, "Migration failed — aborting startup");
  process.exit(1);
}

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
