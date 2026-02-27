/**
 * CI Build comparison — side-by-side comparison of builds between branches.
 * Compares average duration, size, success rate, and trends.
 */
import { db } from "@/db";
import { ciBuilds } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "ci-build-comparison" });

export interface BranchBuildStats {
  branch: string;
  buildCount: number;
  avgDurationMs: number;
  avgSizeBytes: number | null;
  successRate: number;
  latestDurationMs: number | null;
  latestSizeBytes: number | null;
  latestStatus: string | null;
  latestCommit: string | null;
}

export interface BuildComparison {
  branchA: BranchBuildStats;
  branchB: BranchBuildStats;
  durationDiffMs: number;
  durationDiffPct: number;
  sizeDiffBytes: number | null;
  sizeDiffPct: number | null;
  successRateDiff: number;
}

/**
 * Get build stats for a specific branch.
 */
export async function getBranchBuildStats(
  branch: string,
  limit = 20
): Promise<BranchBuildStats> {
  try {
    const builds = await db
      .select()
      .from(ciBuilds)
      .where(eq(ciBuilds.branch, branch))
      .orderBy(desc(ciBuilds.createdAt))
      .limit(limit);

    if (builds.length === 0) {
      return {
        branch,
        buildCount: 0,
        avgDurationMs: 0,
        avgSizeBytes: null,
        successRate: 0,
        latestDurationMs: null,
        latestSizeBytes: null,
        latestStatus: null,
        latestCommit: null,
      };
    }

    const durations = builds.map((b) => b.durationMs);
    const sizes = builds
      .map((b) => b.buildSizeBytes)
      .filter((s): s is number => s !== null);
    const successCount = builds.filter((b) => b.status === "success").length;
    const latest = builds[0];

    return {
      branch,
      buildCount: builds.length,
      avgDurationMs: Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      ),
      avgSizeBytes:
        sizes.length > 0
          ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)
          : null,
      successRate: Math.round((successCount / builds.length) * 100),
      latestDurationMs: latest.durationMs,
      latestSizeBytes: latest.buildSizeBytes,
      latestStatus: latest.status,
      latestCommit: latest.commitHash,
    };
  } catch (err) {
    log.warn({ err, branch }, "Failed to get branch build stats");
    return {
      branch,
      buildCount: 0,
      avgDurationMs: 0,
      avgSizeBytes: null,
      successRate: 0,
      latestDurationMs: null,
      latestSizeBytes: null,
      latestStatus: null,
      latestCommit: null,
    };
  }
}

/**
 * Compare builds between two branches side-by-side.
 */
export async function compareBranches(
  branchA: string,
  branchB: string,
  limit = 20
): Promise<BuildComparison> {
  const [statsA, statsB] = await Promise.all([
    getBranchBuildStats(branchA, limit),
    getBranchBuildStats(branchB, limit),
  ]);

  const durationDiffMs = statsA.avgDurationMs - statsB.avgDurationMs;
  const durationDiffPct =
    statsB.avgDurationMs > 0
      ? Math.round((durationDiffMs / statsB.avgDurationMs) * 100)
      : 0;

  let sizeDiffBytes: number | null = null;
  let sizeDiffPct: number | null = null;
  if (statsA.avgSizeBytes !== null && statsB.avgSizeBytes !== null) {
    sizeDiffBytes = statsA.avgSizeBytes - statsB.avgSizeBytes;
    sizeDiffPct =
      statsB.avgSizeBytes > 0
        ? Math.round((sizeDiffBytes / statsB.avgSizeBytes) * 100)
        : 0;
  }

  const successRateDiff = statsA.successRate - statsB.successRate;

  log.info(
    { branchA, branchB, durationDiffPct, successRateDiff },
    "Branch comparison computed"
  );

  return {
    branchA: statsA,
    branchB: statsB,
    durationDiffMs,
    durationDiffPct,
    sizeDiffBytes,
    sizeDiffPct,
    successRateDiff,
  };
}

/**
 * Get list of distinct branches that have builds recorded.
 */
export async function getAvailableBranches(): Promise<string[]> {
  try {
    const rows = await db
      .select({ branch: ciBuilds.branch })
      .from(ciBuilds)
      .groupBy(ciBuilds.branch)
      .orderBy(desc(sql`COUNT(*)`));

    return rows.map((r) => r.branch);
  } catch {
    return [];
  }
}
