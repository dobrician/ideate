import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { logger } from "@/lib/logger";

const DB_PATH = process.env.DATABASE_URL ?? resolve("data/ideate.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 15000");
sqlite.pragma("foreign_keys = ON");

interface JournalEntry { idx: number; tag: string }
interface Journal { entries: JournalEntry[] }

// Errors that are safe to ignore when re-running migrations
// (e.g., partial application left tables/columns already created)
const IDEMPOTENT_ERRORS = [
  "duplicate column name",
  "already exists",
  "table comments_new already exists",
];

function isIdempotentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return IDEMPOTENT_ERRORS.some((e) => msg.toLowerCase().includes(e));
}

// Auto-apply pending migrations from drizzle journal.
// Uses IMMEDIATE transaction to prevent race conditions when multiple
// Next.js workers import this module simultaneously.
// Tolerates idempotent errors (duplicate column, table exists) to handle
// partially-applied migrations safely.
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

  // Acquire exclusive write lock before checking/applying migrations
  sqlite.exec("BEGIN IMMEDIATE");
  try {
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
        try {
          sqlite.exec(stmt);
        } catch (stmtErr) {
          if (isIdempotentError(stmtErr)) {
            logger.info({ migration: file, error: String(stmtErr) },
              "Skipped idempotent statement");
            continue;
          }
          throw stmtErr;
        }
      }

      sqlite.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
      logger.info({ migration: file }, "Applied migration");
    }
    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

// Rebuild FTS5 indexes so pre-existing data is searchable.
// This is idempotent and fast — FTS5 'rebuild' re-reads the content tables.
function rebuildFtsIndexes(): void {
  const ftsTables = ["projects_fts", "proposals_fts", "comments_fts"];
  for (const table of ftsTables) {
    try {
      sqlite.exec(`INSERT INTO ${table}(${table}) VALUES('rebuild')`);
    } catch {
      // Table may not exist yet if its migration hasn't been applied
    }
  }
  logger.info("FTS indexes rebuilt");
}

const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    applyMigrations();
    rebuildFtsIndexes();
    break;
  } catch (error) {
    const isBusy = error instanceof Error &&
      error.message.includes("SQLITE_BUSY");
    if (isBusy && attempt < MAX_RETRIES) {
      logger.info({ attempt }, "Migration locked, retrying...");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0,
        1000 * attempt);
      continue;
    }
    logger.fatal({ err: error }, "Migration failed — aborting startup");
    process.exit(1);
  }
}

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
