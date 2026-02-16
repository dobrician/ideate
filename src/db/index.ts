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

interface JournalEntry { idx: number; tag: string }
interface Journal { entries: JournalEntry[] }

// Auto-apply pending migrations from drizzle journal
function applyMigrations(): void {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER DEFAULT (unixepoch()))"
  );

  const migrationDir = resolve("drizzle");
  const journalPath = resolve(migrationDir, "meta", "_journal.json");
  if (!existsSync(journalPath)) return;

  const journal: Journal = JSON.parse(readFileSync(journalPath, "utf-8"));
  const migrations = journal.entries
    .sort((a, b) => a.idx - b.idx)
    .map((e) => `${e.tag}.sql`);

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
    logger.info({ migration: file }, "Applied migration");
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
