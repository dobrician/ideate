/**
 * CI Build metrics — records and queries build timing data.
 * Used to track build duration trends and detect regressions.
 */

import { db } from "@/db";
import { ciBuilds } from "@/db/schema";
import { desc, lte, sql, count as countFn } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "ci-builds" });

export interface CiBuildRecord {
  commitHash: string;
  branch?: string;
  durationMs: number;
  buildSizeBytes?: number;
  status?: "success" | "failure";
  runId?: string;
}

export interface CiBuildEntry {
  id: string;
  commitHash: string;
  branch: string;
  durationMs: number;
  buildSizeBytes: number | null;
  status: string;
  runId: string | null;
  createdAt: Date | null;
}

/** Record a CI build metric. */
export async function recordCiBuild(record: CiBuildRecord): Promise<void> {
  await db.insert(ciBuilds).values({
    commitHash: record.commitHash,
    branch: record.branch ?? "main",
    durationMs: record.durationMs,
    buildSizeBytes: record.buildSizeBytes ?? null,
    status: record.status ?? "success",
    runId: record.runId ?? null,
  });
}

/** Get recent CI builds for trend display. */
export async function getRecentCiBuilds(limit = 30): Promise<CiBuildEntry[]> {
  return db
    .select()
    .from(ciBuilds)
    .orderBy(desc(ciBuilds.createdAt))
    .limit(limit);
}

/** Get build timing stats: avg, min, max, count over recent builds. */
export async function getCiBuildStats(limit = 30): Promise<{
  count: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  latestDurationMs: number | null;
  trend: "improving" | "stable" | "regressing" | "insufficient";
}> {
  const builds = await getRecentCiBuilds(limit);

  if (builds.length === 0) {
    return {
      count: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      latestDurationMs: null,
      trend: "insufficient",
    };
  }

  const durations = builds.map((b) => b.durationMs);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / durations.length);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const latest = durations[0];

  // Trend: compare latest 5 vs previous 5
  let trend: "improving" | "stable" | "regressing" | "insufficient" = "insufficient";
  if (builds.length >= 6) {
    const recent5 = durations.slice(0, 5);
    const prev5 = durations.slice(5, 10);
    if (prev5.length >= 3) {
      const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
      const prevAvg = prev5.reduce((a, b) => a + b, 0) / prev5.length;
      const change = (recentAvg - prevAvg) / prevAvg;
      if (change > 0.1) trend = "regressing";
      else if (change < -0.1) trend = "improving";
      else trend = "stable";
    }
  }

  return { count: builds.length, avgDurationMs: avg, minDurationMs: min, maxDurationMs: max, latestDurationMs: latest, trend };
}

/** Get retention days from env, default 90 */
export function getCiBuildRetentionDays(): number {
  const env = process.env.CI_BUILD_RETENTION_DAYS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 90;
}

/**
 * Prune CI builds older than retentionDays.
 * Returns the number of deleted records.
 */
export async function pruneCiBuilds(retentionDays?: number): Promise<number> {
  const days = retentionDays ?? getCiBuildRetentionDays();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  const result = await db
    .delete(ciBuilds)
    .where(lte(ciBuilds.createdAt, cutoff));

  const deleted = result.changes ?? 0;
  log.info({ retentionDays: days, deleted }, "Pruned old CI builds");
  return deleted;
}

/**
 * Get CI build retention stats: total records, oldest record age.
 */
export async function getCiBuildRetentionStats(): Promise<{
  totalRecords: number;
  oldestDaysAgo: number;
  retentionDays: number;
}> {
  const [stats] = await db
    .select({
      total: countFn(),
      oldest: sql<number>`MIN(${ciBuilds.createdAt})`.as("oldest"),
    })
    .from(ciBuilds);

  const total = stats?.total ?? 0;
  const oldestTs = stats?.oldest;
  const oldestDaysAgo = oldestTs
    ? Math.round((Date.now() / 1000 - oldestTs) / 86400)
    : 0;

  return {
    totalRecords: total,
    oldestDaysAgo,
    retentionDays: getCiBuildRetentionDays(),
  };
}
