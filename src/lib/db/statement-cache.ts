/**
 * Prepared statement cache for SQLite.
 * Reuses compiled SQL statements across repeated queries for performance.
 */

import { logger } from "@/lib/logger";

interface CachedStatement {
  sql: string;
  lastUsed: number;
  useCount: number;
}

const MAX_CACHED_STATEMENTS = 200;

/** Statement metadata cache (the actual prepared statements live in better-sqlite3). */
const statementMeta = new Map<string, CachedStatement>();

/**
 * Track a prepared statement usage.
 * Call this when a query uses a parameterized SQL string.
 */
export function trackStatement(sql: string): void {
  const existing = statementMeta.get(sql);
  if (existing) {
    existing.lastUsed = Date.now();
    existing.useCount++;
    return;
  }

  // Evict least recently used if at capacity
  if (statementMeta.size >= MAX_CACHED_STATEMENTS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, meta] of statementMeta) {
      if (meta.lastUsed < oldestTime) {
        oldestTime = meta.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      statementMeta.delete(oldestKey);
    }
  }

  statementMeta.set(sql, {
    sql,
    lastUsed: Date.now(),
    useCount: 1,
  });
}

/** Get statistics about the statement cache. */
export function getStatementCacheStats(): {
  totalCached: number;
  maxCapacity: number;
  topStatements: { sql: string; useCount: number }[];
} {
  const entries = Array.from(statementMeta.values());
  const topStatements = entries
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, 10)
    .map(({ sql, useCount }) => ({
      sql: sql.length > 100 ? sql.slice(0, 100) + "..." : sql,
      useCount,
    }));

  return {
    totalCached: statementMeta.size,
    maxCapacity: MAX_CACHED_STATEMENTS,
    topStatements,
  };
}

/** Clear all cached statement metadata. */
export function clearStatementCache(): void {
  statementMeta.clear();
  logger.info("Statement cache cleared");
}
