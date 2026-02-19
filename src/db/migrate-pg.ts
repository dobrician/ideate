/**
 * PostgreSQL migration runner.
 * Reads the drizzle-pg journal and applies pending SQL migrations.
 * Mirrors the SQLite migration logic in src/db/index.ts but uses pg Pool.
 */

import { Pool } from "pg";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { logger } from "@/lib/logger";

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

/** Errors safe to ignore during re-runs (partial prior application). */
const IDEMPOTENT_ERRORS = [
  "already exists",
  "duplicate key value",
  "relation already exists",
  "column already exists",
];

function isIdempotentError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return IDEMPOTENT_ERRORS.some((e) => msg.toLowerCase().includes(e));
}

/**
 * Apply pending PostgreSQL migrations from drizzle-pg/.
 * Uses advisory lock to prevent concurrent migration from multiple workers.
 */
export async function applyPgMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Advisory lock prevents concurrent migration across workers
    await client.query("SELECT pg_advisory_lock(42)");

    await client.query(
      `CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT now()
      )`
    );

    const migrationDir = resolve("drizzle-pg");
    const journalPath = resolve(migrationDir, "meta", "_journal.json");
    if (!existsSync(journalPath)) return;

    const journal: Journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    const migrations = journal.entries
      .sort((a, b) => a.idx - b.idx)
      .map((e) => `${e.tag}.sql`);

    for (const file of migrations) {
      const { rows } = await client.query(
        "SELECT 1 FROM _migrations WHERE name = $1",
        [file]
      );
      if (rows.length > 0) continue;

      const filePath = resolve(migrationDir, file);
      if (!existsSync(filePath)) continue;

      const sql = readFileSync(filePath, "utf-8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      await client.query("BEGIN");
      try {
        for (const stmt of statements) {
          try {
            await client.query(stmt);
          } catch (stmtErr) {
            if (isIdempotentError(stmtErr)) {
              logger.info(
                { migration: file, error: String(stmtErr) },
                "Skipped idempotent statement"
              );
              continue;
            }
            throw stmtErr;
          }
        }

        await client.query(
          "INSERT INTO _migrations (name) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        logger.info({ migration: file }, "Applied PG migration");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    // Always release advisory lock
    try {
      await client.query("SELECT pg_advisory_unlock(42)");
    } catch {
      // Best-effort unlock
    }
    client.release();
  }
}
