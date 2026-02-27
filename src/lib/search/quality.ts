/**
 * Search quality — feedback collection and RRF tuning configuration.
 * Allows users to rate search results (thumbs up/down) and tracks
 * per-mode effectiveness for adaptive search quality improvement.
 */
import { db } from "@/db";
import { searchFeedback, searchAnalytics } from "@/db/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "search-quality" });

/** Default RRF K parameter — controls how quickly rank influence decays */
const DEFAULT_RRF_K = 60;

/** Get the configured RRF K parameter */
export function getRrfK(): number {
  const envK = process.env.SEARCH_RRF_K;
  if (envK) {
    const parsed = parseInt(envK, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 1000) return parsed;
  }
  return DEFAULT_RRF_K;
}

/**
 * Record user feedback on a search result.
 * @param rating - 1 for positive (thumbs up), -1 for negative (thumbs down)
 */
export async function recordSearchFeedback(params: {
  userId: string;
  analyticsId: string;
  resultId: string;
  resultType: "project" | "proposal" | "comment";
  rating: 1 | -1;
}): Promise<void> {
  try {
    // Check for existing feedback and update
    const existing = await db
      .select({ id: searchFeedback.id })
      .from(searchFeedback)
      .where(
        and(
          eq(searchFeedback.analyticsId, params.analyticsId),
          eq(searchFeedback.resultId, params.resultId),
          eq(searchFeedback.userId, params.userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(searchFeedback)
        .set({ rating: params.rating })
        .where(eq(searchFeedback.id, existing[0].id));
    } else {
      await db.insert(searchFeedback).values({
        id: randomUUID(),
        userId: params.userId,
        analyticsId: params.analyticsId,
        resultId: params.resultId,
        resultType: params.resultType,
        rating: params.rating,
      });
    }
  } catch (err) {
    log.warn({ err }, "Failed to record search feedback");
  }
}

/**
 * Get search quality stats: positive/negative feedback counts by mode.
 */
export async function getSearchQualityStats(daysBack = 30): Promise<{
  totalFeedback: number;
  positiveRate: number;
  byMode: Record<string, { positive: number; negative: number; total: number }>;
}> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400;

  try {
    const rows = await db
      .select({
        mode: searchAnalytics.mode,
        rating: searchFeedback.rating,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(searchFeedback)
      .innerJoin(searchAnalytics, eq(searchFeedback.analyticsId, searchAnalytics.id))
      .where(gte(searchFeedback.createdAt, new Date(cutoff * 1000)))
      .groupBy(searchAnalytics.mode, searchFeedback.rating);

    const byMode: Record<string, { positive: number; negative: number; total: number }> = {};
    let totalPositive = 0;
    let totalAll = 0;

    for (const row of rows) {
      if (!byMode[row.mode]) {
        byMode[row.mode] = { positive: 0, negative: 0, total: 0 };
      }
      const cnt = row.count;
      if (row.rating > 0) {
        byMode[row.mode].positive += cnt;
        totalPositive += cnt;
      } else {
        byMode[row.mode].negative += cnt;
      }
      byMode[row.mode].total += cnt;
      totalAll += cnt;
    }

    return {
      totalFeedback: totalAll,
      positiveRate: totalAll > 0 ? (totalPositive / totalAll) * 100 : 0,
      byMode,
    };
  } catch {
    return { totalFeedback: 0, positiveRate: 0, byMode: {} };
  }
}
