/**
 * CI regression alerts engine — detects regressions between branches/runs
 * (duration, size, failure rate) with configurable thresholds and
 * persists alerts for historical tracking.
 */
import { db } from "@/db";
import { ciRegressionAlerts } from "@/db/schema";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getRecentCiBuilds, getCiAlertThreshold } from "@/lib/ci-builds";
import { compareBranches } from "@/lib/ci-build-comparison";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "ci-regression-alerts" });

export interface CiAlert {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  branch: string | null;
  avgRecentMs: number | null;
  avgBaselineMs: number | null;
  regressionPct: number | null;
  failureCount: number | null;
  threshold: number;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date | null;
}

/** Duration regression threshold (percentage). Default 20%, configurable via env. */
export function getDurationRegressionThreshold(): number {
  const env = process.env.CI_DURATION_REGRESSION_PCT;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) return parsed;
  }
  return 20;
}

/** Size regression threshold (percentage). Default 10%, configurable via env. */
export function getSizeRegressionThreshold(): number {
  const env = process.env.CI_SIZE_REGRESSION_PCT;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 100) return parsed;
  }
  return 10;
}

/**
 * Run the full regression detection engine.
 * Checks for duration regressions, failure streaks, and size regressions.
 * Persists new alerts and returns them.
 */
export async function detectAndPersistRegressions(): Promise<CiAlert[]> {
  const newAlerts: CiAlert[] = [];
  const threshold = getCiAlertThreshold();
  const durationPct = getDurationRegressionThreshold();

  try {
    const builds = await getRecentCiBuilds(threshold * 3);
    if (builds.length < threshold + 3) return [];

    const recentBuilds = builds.slice(0, threshold);
    const baselineBuilds = builds.slice(threshold, threshold * 2);

    // 1. Failure streak detection
    const failureStreak = recentBuilds.every((b) => b.status === "failure");
    if (failureStreak) {
      const alert = await persistAlert({
        alertType: "failure_streak",
        severity: "critical",
        message: `${threshold} consecutive build failures detected`,
        branch: recentBuilds[0]?.branch ?? null,
        failureCount: threshold,
        threshold,
      });
      if (alert) newAlerts.push(alert);
    }

    // 2. Duration regression detection
    const successRecent = recentBuilds.filter((b) => b.status === "success");
    const successBaseline = baselineBuilds.filter((b) => b.status === "success");
    if (successRecent.length >= 2 && successBaseline.length >= 2) {
      const avgRecent = Math.round(
        successRecent.reduce((s, b) => s + b.durationMs, 0) / successRecent.length
      );
      const avgBaseline = Math.round(
        successBaseline.reduce((s, b) => s + b.durationMs, 0) / successBaseline.length
      );
      const pct = ((avgRecent - avgBaseline) / avgBaseline) * 100;

      if (pct > durationPct) {
        const alert = await persistAlert({
          alertType: "regression",
          severity: pct > durationPct * 2 ? "critical" : "warning",
          message: `Builds are ${Math.round(pct)}% slower than baseline (${avgRecent}ms vs ${avgBaseline}ms)`,
          branch: recentBuilds[0]?.branch ?? null,
          avgRecentMs: avgRecent,
          avgBaselineMs: avgBaseline,
          regressionPct: Math.round(pct * 100) / 100,
          threshold,
        });
        if (alert) newAlerts.push(alert);
      }
    }

    // 3. Size regression detection
    const sizePct = getSizeRegressionThreshold();
    const recentSizes = successRecent
      .map((b) => b.buildSizeBytes)
      .filter((s): s is number => s !== null);
    const baselineSizes = successBaseline
      .map((b) => b.buildSizeBytes)
      .filter((s): s is number => s !== null);

    if (recentSizes.length >= 2 && baselineSizes.length >= 2) {
      const avgRecentSize = Math.round(recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length);
      const avgBaselineSize = Math.round(baselineSizes.reduce((a, b) => a + b, 0) / baselineSizes.length);
      const sizeChange = ((avgRecentSize - avgBaselineSize) / avgBaselineSize) * 100;

      if (sizeChange > sizePct) {
        const alert = await persistAlert({
          alertType: "size_regression",
          severity: sizeChange > sizePct * 2 ? "critical" : "warning",
          message: `Build size increased ${Math.round(sizeChange)}% (${(avgRecentSize / 1024 / 1024).toFixed(1)}MB vs ${(avgBaselineSize / 1024 / 1024).toFixed(1)}MB)`,
          branch: recentBuilds[0]?.branch ?? null,
          avgRecentMs: avgRecentSize,
          avgBaselineMs: avgBaselineSize,
          regressionPct: Math.round(sizeChange * 100) / 100,
          threshold,
        });
        if (alert) newAlerts.push(alert);
      }
    }

    if (newAlerts.length > 0) {
      log.warn({ alertCount: newAlerts.length }, "CI regression alerts detected");
    }
    return newAlerts;
  } catch (err) {
    log.error({ err }, "Failed to detect CI regressions");
    return [];
  }
}

/**
 * Detect cross-branch regressions by comparing a branch against main.
 */
export async function detectBranchRegression(
  branch: string,
  baseBranch = "main"
): Promise<CiAlert | null> {
  try {
    if (branch === baseBranch) return null;
    const comparison = await compareBranches(branch, baseBranch);
    const durationPct = getDurationRegressionThreshold();

    if (comparison.durationDiffPct > durationPct && comparison.branchA.buildCount >= 3) {
      const alert = await persistAlert({
        alertType: "regression",
        severity: comparison.durationDiffPct > durationPct * 2 ? "critical" : "warning",
        message: `Branch "${branch}" is ${comparison.durationDiffPct}% slower than "${baseBranch}"`,
        branch,
        avgRecentMs: comparison.branchA.avgDurationMs,
        avgBaselineMs: comparison.branchB.avgDurationMs,
        regressionPct: comparison.durationDiffPct,
        threshold: getCiAlertThreshold(),
      });
      return alert;
    }
    return null;
  } catch (err) {
    log.warn({ err, branch }, "Failed to detect branch regression");
    return null;
  }
}

async function persistAlert(data: {
  alertType: string;
  severity: string;
  message: string;
  branch?: string | null;
  avgRecentMs?: number;
  avgBaselineMs?: number;
  regressionPct?: number;
  failureCount?: number;
  threshold: number;
}): Promise<CiAlert | null> {
  try {
    const [row] = await db
      .insert(ciRegressionAlerts)
      .values({
        alertType: data.alertType as "regression" | "failure_streak" | "size_regression",
        severity: data.severity as "warning" | "critical",
        message: data.message,
        branch: data.branch ?? null,
        avgRecentMs: data.avgRecentMs ?? null,
        avgBaselineMs: data.avgBaselineMs ?? null,
        regressionPct: data.regressionPct ?? null,
        failureCount: data.failureCount ?? null,
        threshold: data.threshold,
      })
      .returning();

    return deserializeAlert(row);
  } catch (err) {
    log.error({ err }, "Failed to persist alert");
    return null;
  }
}

/**
 * Get recent CI regression alerts.
 */
export async function getRecentAlerts(limit = 50): Promise<CiAlert[]> {
  try {
    const rows = await db
      .select()
      .from(ciRegressionAlerts)
      .orderBy(desc(ciRegressionAlerts.createdAt))
      .limit(limit);
    return rows.map(deserializeAlert);
  } catch {
    return [];
  }
}

/**
 * Get active (unresolved) alerts.
 */
export async function getActiveAlerts(): Promise<CiAlert[]> {
  try {
    const rows = await db
      .select()
      .from(ciRegressionAlerts)
      .where(eq(ciRegressionAlerts.resolved, false))
      .orderBy(desc(ciRegressionAlerts.createdAt));
    return rows.map(deserializeAlert);
  } catch {
    return [];
  }
}

/**
 * Resolve an alert by ID.
 */
export async function resolveAlert(alertId: string): Promise<boolean> {
  try {
    await db
      .update(ciRegressionAlerts)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(eq(ciRegressionAlerts.id, alertId));
    log.info({ alertId }, "Alert resolved");
    return true;
  } catch (err) {
    log.error({ err, alertId }, "Failed to resolve alert");
    return false;
  }
}

/**
 * Get alert statistics — total, active, resolved, by type.
 */
export async function getAlertStats(): Promise<{
  total: number;
  active: number;
  resolved: number;
  byType: Record<string, number>;
}> {
  try {
    const rows = await db
      .select({
        alertType: ciRegressionAlerts.alertType,
        resolved: ciRegressionAlerts.resolved,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(ciRegressionAlerts)
      .groupBy(ciRegressionAlerts.alertType, ciRegressionAlerts.resolved);

    let total = 0;
    let active = 0;
    let resolved = 0;
    const byType: Record<string, number> = {};

    for (const row of rows) {
      total += row.count;
      if (row.resolved) resolved += row.count;
      else active += row.count;
      byType[row.alertType] = (byType[row.alertType] ?? 0) + row.count;
    }

    return { total, active, resolved, byType };
  } catch {
    return { total: 0, active: 0, resolved: 0, byType: {} };
  }
}

function deserializeAlert(row: {
  id: string;
  alertType: string;
  severity: string;
  message: string;
  branch: string | null;
  avgRecentMs: number | null;
  avgBaselineMs: number | null;
  regressionPct: number | null;
  failureCount: number | null;
  threshold: number;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date | null;
}): CiAlert {
  return {
    id: row.id,
    alertType: row.alertType,
    severity: row.severity,
    message: row.message,
    branch: row.branch,
    avgRecentMs: row.avgRecentMs,
    avgBaselineMs: row.avgBaselineMs,
    regressionPct: row.regressionPct,
    failureCount: row.failureCount,
    threshold: row.threshold,
    resolved: Boolean(row.resolved),
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}
