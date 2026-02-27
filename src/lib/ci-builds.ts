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

/** Default threshold for CI alert: 3 consecutive regressing builds */
const DEFAULT_ALERT_CONSECUTIVE = 3;

/** Configurable alert threshold from env */
export function getCiAlertThreshold(): number {
  const env = process.env.CI_ALERT_THRESHOLD;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed >= 2 && parsed <= 20) return parsed;
  }
  return DEFAULT_ALERT_CONSECUTIVE;
}

/**
 * Check for CI build alerts — detects consecutive regressions.
 * Returns alert details if recent builds are significantly slower than baseline.
 */
export async function checkCiBuildAlerts(): Promise<{
  alert: boolean;
  type: "regression" | "failure_streak" | null;
  message: string | null;
  details: {
    consecutiveCount: number;
    avgRecentMs: number;
    avgBaselineMs: number;
    threshold: number;
  } | null;
}> {
  const threshold = getCiAlertThreshold();
  const builds = await getRecentCiBuilds(threshold * 2 + 5);

  if (builds.length < threshold + 3) {
    return { alert: false, type: null, message: null, details: null };
  }

  // Check failure streak
  const recentBuilds = builds.slice(0, threshold);
  const failureStreak = recentBuilds.every((b) => b.status === "failure");
  if (failureStreak) {
    return {
      alert: true,
      type: "failure_streak",
      message: `CI alert: ${threshold} consecutive build failures detected`,
      details: {
        consecutiveCount: threshold,
        avgRecentMs: 0,
        avgBaselineMs: 0,
        threshold,
      },
    };
  }

  // Check duration regression
  const successfulRecent = recentBuilds.filter((b) => b.status === "success");
  const baselineBuilds = builds.slice(threshold, threshold * 2).filter((b) => b.status === "success");

  if (successfulRecent.length < threshold || baselineBuilds.length < 2) {
    return { alert: false, type: null, message: null, details: null };
  }

  const avgRecent = successfulRecent.reduce((s, b) => s + b.durationMs, 0) / successfulRecent.length;
  const avgBaseline = baselineBuilds.reduce((s, b) => s + b.durationMs, 0) / baselineBuilds.length;

  // Alert if recent builds are >20% slower than baseline
  const regressionPct = (avgRecent - avgBaseline) / avgBaseline;
  if (regressionPct > 0.2) {
    return {
      alert: true,
      type: "regression",
      message: `CI alert: builds are ${Math.round(regressionPct * 100)}% slower than baseline (${Math.round(avgRecent)}ms vs ${Math.round(avgBaseline)}ms)`,
      details: {
        consecutiveCount: threshold,
        avgRecentMs: Math.round(avgRecent),
        avgBaselineMs: Math.round(avgBaseline),
        threshold,
      },
    };
  }

  return { alert: false, type: null, message: null, details: null };
}

/**
 * Get CI build alert summary — recent failures, rate, trend, and current alert.
 */
export async function getCiBuildAlertSummary(): Promise<{
  recentFailures: number;
  totalBuilds: number;
  failureRate: number;
  trend: "improving" | "stable" | "regressing" | "insufficient";
  currentAlert: Awaited<ReturnType<typeof checkCiBuildAlerts>>;
}> {
  const [stats, alertCheck] = await Promise.all([
    getCiBuildStats(30),
    checkCiBuildAlerts(),
  ]);

  const builds = await getRecentCiBuilds(30);
  const recentFailures = builds.filter((b) => b.status === "failure").length;

  return {
    recentFailures,
    totalBuilds: stats.count,
    failureRate: stats.count > 0 ? Math.round((recentFailures / stats.count) * 100) : 0,
    trend: stats.trend,
    currentAlert: alertCheck,
  };
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
