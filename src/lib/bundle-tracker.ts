/**
 * Bundle size tracking — analyzes CI build sizes over time,
 * detects size regressions, and provides performance budget validation.
 */

import { db } from "@/db";
import { ciBuilds } from "@/db/schema";
import { desc, sql, isNotNull } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "bundle-tracker" });

/** Performance budget configuration from env or defaults */
export interface PerfBudget {
  maxBuildSizeBytes: number;
  maxBuildDurationMs: number;
  sizeRegressionThresholdPct: number;
}

/** Get performance budget from env */
export function getPerfBudget(): PerfBudget {
  return {
    maxBuildSizeBytes: parseEnvInt("PERF_BUDGET_MAX_SIZE_BYTES", 800 * 1024 * 1024), // 800MB default
    maxBuildDurationMs: parseEnvInt("PERF_BUDGET_MAX_DURATION_MS", 120_000), // 120s default
    sizeRegressionThresholdPct: parseEnvFloat("PERF_BUDGET_SIZE_REGRESSION_PCT", 5), // 5% default
  };
}

/** Bundle size history entry */
export interface BundleSizeEntry {
  commitHash: string;
  branch: string;
  sizeBytes: number;
  durationMs: number;
  createdAt: Date | null;
}

/**
 * Get bundle size history for trend analysis.
 */
export async function getBundleSizeHistory(limit = 30): Promise<BundleSizeEntry[]> {
  try {
    const rows = await db
      .select({
        commitHash: ciBuilds.commitHash,
        branch: ciBuilds.branch,
        sizeBytes: ciBuilds.buildSizeBytes,
        durationMs: ciBuilds.durationMs,
        createdAt: ciBuilds.createdAt,
      })
      .from(ciBuilds)
      .where(isNotNull(ciBuilds.buildSizeBytes))
      .orderBy(desc(ciBuilds.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      commitHash: r.commitHash,
      branch: r.branch,
      sizeBytes: r.sizeBytes!,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    log.warn({ err }, "Failed to get bundle size history");
    return [];
  }
}

/**
 * Get bundle size analytics — current size, trend, budget compliance.
 */
export async function getBundleSizeAnalytics(): Promise<{
  current: { sizeBytes: number; sizeMb: string } | null;
  trend: "growing" | "shrinking" | "stable" | "insufficient";
  avgSizeBytes: number;
  minSizeBytes: number;
  maxSizeBytes: number;
  budgetStatus: {
    sizeWithinBudget: boolean;
    durationWithinBudget: boolean;
    sizeUsagePct: number;
    durationUsagePct: number;
  };
  recentEntries: number;
}> {
  const history = await getBundleSizeHistory(20);
  const budget = getPerfBudget();

  if (history.length === 0) {
    return {
      current: null,
      trend: "insufficient",
      avgSizeBytes: 0,
      minSizeBytes: 0,
      maxSizeBytes: 0,
      budgetStatus: {
        sizeWithinBudget: true,
        durationWithinBudget: true,
        sizeUsagePct: 0,
        durationUsagePct: 0,
      },
      recentEntries: 0,
    };
  }

  const sizes = history.map((h) => h.sizeBytes);
  const currentSize = sizes[0];
  const avg = Math.round(sizes.reduce((s, v) => s + v, 0) / sizes.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);

  // Trend: compare latest 5 vs previous 5
  let trend: "growing" | "shrinking" | "stable" | "insufficient" = "insufficient";
  if (history.length >= 6) {
    const recent5Avg = sizes.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const prev5Avg = sizes.slice(5, 10).reduce((s, v) => s + v, 0) / Math.min(sizes.slice(5, 10).length, 5);
    if (sizes.slice(5, 10).length >= 3) {
      const change = (recent5Avg - prev5Avg) / prev5Avg;
      if (change > 0.02) trend = "growing";
      else if (change < -0.02) trend = "shrinking";
      else trend = "stable";
    }
  }

  const latestDuration = history[0].durationMs;

  return {
    current: {
      sizeBytes: currentSize,
      sizeMb: (currentSize / (1024 * 1024)).toFixed(1),
    },
    trend,
    avgSizeBytes: avg,
    minSizeBytes: min,
    maxSizeBytes: max,
    budgetStatus: {
      sizeWithinBudget: currentSize <= budget.maxBuildSizeBytes,
      durationWithinBudget: latestDuration <= budget.maxBuildDurationMs,
      sizeUsagePct: Math.round((currentSize / budget.maxBuildSizeBytes) * 100),
      durationUsagePct: Math.round((latestDuration / budget.maxBuildDurationMs) * 100),
    },
    recentEntries: history.length,
  };
}

/**
 * Check for bundle size regressions — compares latest vs baseline.
 */
export async function checkBundleSizeRegression(): Promise<{
  regression: boolean;
  message: string | null;
  currentMb: string | null;
  baselineMb: string | null;
  changePct: number | null;
}> {
  const history = await getBundleSizeHistory(10);
  const budget = getPerfBudget();

  if (history.length < 2) {
    return { regression: false, message: null, currentMb: null, baselineMb: null, changePct: null };
  }

  const current = history[0].sizeBytes;
  const baseline = history.slice(1, 6);
  const baselineAvg = baseline.reduce((s, h) => s + h.sizeBytes, 0) / baseline.length;

  const changePct = ((current - baselineAvg) / baselineAvg) * 100;
  const regression = changePct > budget.sizeRegressionThresholdPct;

  if (regression) {
    const msg = `Bundle size regression: ${(current / 1024 / 1024).toFixed(1)}MB (${changePct.toFixed(1)}% increase from ${(baselineAvg / 1024 / 1024).toFixed(1)}MB baseline)`;
    log.warn({ current, baselineAvg, changePct: changePct.toFixed(1) }, msg);
    return {
      regression: true,
      message: msg,
      currentMb: (current / 1024 / 1024).toFixed(1),
      baselineMb: (baselineAvg / 1024 / 1024).toFixed(1),
      changePct: Math.round(changePct * 10) / 10,
    };
  }

  return {
    regression: false,
    message: null,
    currentMb: (current / 1024 / 1024).toFixed(1),
    baselineMb: (baselineAvg / 1024 / 1024).toFixed(1),
    changePct: Math.round(changePct * 10) / 10,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseEnvInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v) {
    const parsed = parseInt(v, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function parseEnvFloat(key: string, fallback: number): number {
  const v = process.env[key];
  if (v) {
    const parsed = parseFloat(v);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}
