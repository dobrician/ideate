/**
 * Embedding quality trend tracking — persists periodic quality snapshots
 * and exposes trend data for the admin dashboard.
 */
import { db } from "@/db";
import { embeddingQualitySnapshots } from "@/db/schema";
import { desc, gte, sql } from "drizzle-orm";
import { getEmbeddingQualityScore } from "./quality";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "embedding-quality-trends" });

export interface QualitySnapshot {
  id: string;
  overallScore: number;
  selfSimilarity: number;
  crossSimilarity: number;
  separation: number;
  sampleSize: number;
  grade: string;
  byModel: Record<string, { avgSimilarity: number; count: number }>;
  createdAt: Date | null;
}

/**
 * Take a quality snapshot — compute current quality and persist it.
 * Intended to be called from the cron job (e.g., daily).
 */
export async function takeQualitySnapshot(): Promise<QualitySnapshot | null> {
  try {
    const score = await getEmbeddingQualityScore();
    if (score.sampleSize === 0) {
      log.info("Skipping snapshot — no embeddings to score");
      return null;
    }

    const [row] = await db
      .insert(embeddingQualitySnapshots)
      .values({
        overallScore: score.overallScore,
        selfSimilarity: Math.round(score.selfSimilarity * 10000),
        crossSimilarity: Math.round(score.crossSimilarity * 10000),
        separation: Math.round(score.separation * 10000),
        sampleSize: score.sampleSize,
        grade: score.grade,
        byModel: JSON.stringify(score.byModel),
      })
      .returning();

    log.info(
      { overallScore: score.overallScore, grade: score.grade },
      "Quality snapshot taken"
    );

    return deserializeSnapshot(row);
  } catch (err) {
    log.error({ err }, "Failed to take quality snapshot");
    return null;
  }
}

/**
 * Get quality trend data — recent snapshots for charting.
 */
export async function getQualityTrend(
  daysBack = 90,
  limit = 100
): Promise<QualitySnapshot[]> {
  try {
    const cutoff = new Date(Date.now() - daysBack * 86400_000);
    const rows = await db
      .select()
      .from(embeddingQualitySnapshots)
      .where(gte(embeddingQualitySnapshots.createdAt, cutoff))
      .orderBy(desc(embeddingQualitySnapshots.createdAt))
      .limit(limit);

    return rows.map(deserializeSnapshot);
  } catch (err) {
    log.warn({ err }, "Failed to get quality trend");
    return [];
  }
}

/**
 * Get quality trend summary — latest, best, worst, direction.
 */
export async function getQualityTrendSummary(): Promise<{
  latest: QualitySnapshot | null;
  snapshotCount: number;
  avgScore: number;
  trend: "improving" | "stable" | "declining" | "insufficient";
}> {
  try {
    const snapshots = await getQualityTrend(30, 20);

    if (snapshots.length === 0) {
      return { latest: null, snapshotCount: 0, avgScore: 0, trend: "insufficient" };
    }

    const latest = snapshots[0];
    const scores = snapshots.map((s) => s.overallScore);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    let trend: "improving" | "stable" | "declining" | "insufficient" = "insufficient";
    if (snapshots.length >= 4) {
      const recent = scores.slice(0, Math.ceil(scores.length / 2));
      const older = scores.slice(Math.ceil(scores.length / 2));
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const diff = recentAvg - olderAvg;
      if (diff > 5) trend = "improving";
      else if (diff < -5) trend = "declining";
      else trend = "stable";
    }

    return { latest, snapshotCount: snapshots.length, avgScore, trend };
  } catch (err) {
    log.warn({ err }, "Failed to get quality trend summary");
    return { latest: null, snapshotCount: 0, avgScore: 0, trend: "insufficient" };
  }
}

function deserializeSnapshot(row: {
  id: string;
  overallScore: number;
  selfSimilarity: number;
  crossSimilarity: number;
  separation: number;
  sampleSize: number;
  grade: string;
  byModel: string | null;
  createdAt: Date | null;
}): QualitySnapshot {
  let byModel: Record<string, { avgSimilarity: number; count: number }> = {};
  try {
    if (row.byModel) byModel = JSON.parse(row.byModel);
  } catch { /* ignore */ }

  return {
    id: row.id,
    overallScore: row.overallScore,
    selfSimilarity: row.selfSimilarity / 10000,
    crossSimilarity: row.crossSimilarity / 10000,
    separation: row.separation / 10000,
    sampleSize: row.sampleSize,
    grade: row.grade,
    byModel,
    createdAt: row.createdAt,
  };
}
