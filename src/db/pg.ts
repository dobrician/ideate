/**
 * PostgreSQL database adapter using node-postgres with connection pooling.
 * Activated when DATABASE_DRIVER=postgresql is set.
 *
 * Provides the same `db` and `DB` exports as the SQLite adapter (src/db/index.ts)
 * so consumers can import from a unified entry point.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema-pg";
import { logger } from "@/lib/logger";
import { updatePoolStats } from "@/lib/resource-monitor";

const POSTGRESQL_URL = process.env.POSTGRESQL_URL ?? process.env.DATABASE_URL;

if (!POSTGRESQL_URL) {
  throw new Error("POSTGRESQL_URL or DATABASE_URL must be set when DATABASE_DRIVER=postgresql");
}

const pool = new Pool({
  connectionString: POSTGRESQL_URL,
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  logger.error({ err: err.message }, "PostgreSQL pool error");
});

pool.on("connect", () => {
  syncPoolStats();
});

pool.on("remove", () => {
  syncPoolStats();
});

function syncPoolStats(): void {
  updatePoolStats({
    maxConnections: pool.options.max ?? 10,
    activeConnections: pool.totalCount - pool.idleCount,
    idleConnections: pool.idleCount,
  });
}

// Initial pool stats sync
syncPoolStats();

export const db = drizzle(pool, { schema });
export type DB = typeof db;

export { pool };
