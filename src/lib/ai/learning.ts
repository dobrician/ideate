/**
 * AI Feedback Learning System — collects user feedback on AI outputs
 * and tracks aggregate quality metrics per feature/model.
 *
 * Supports three feedback types:
 * - rating (1-5 stars)
 * - thumbs (mapped to 1 or 5)
 * - correction (user-provided fix, rated 1)
 */

import { db } from "@/db";
import { aiFeedback, aiModels } from "@/db/schema";
import { eq, sql, and, desc, gte } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "ai-learning" });

export type AIFeature = "routing" | "conflicts" | "deadlines" | "predictions" | "suggestions";
export type FeedbackType = "rating" | "thumbs" | "correction";

export interface FeedbackInput {
  userId: string;
  feature: AIFeature;
  entityType: "proposal" | "project";
  entityId: string;
  rating: number;
  feedbackType: FeedbackType;
  comment?: string;
  aiOutput?: string;
  correction?: string;
  modelVersion?: string;
}

export interface FeedbackStats {
  feature: AIFeature;
  totalFeedback: number;
  averageRating: number;
  positiveRate: number;
  recentTrend: "improving" | "stable" | "declining";
}

/**
 * Submit feedback on an AI feature output.
 */
export async function submitFeedback(input: FeedbackInput): Promise<string> {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));

  const [row] = await db
    .insert(aiFeedback)
    .values({
      userId: input.userId,
      feature: input.feature,
      entityType: input.entityType,
      entityId: input.entityId,
      rating,
      feedbackType: input.feedbackType,
      comment: input.comment?.slice(0, 1000) ?? null,
      aiOutput: input.aiOutput?.slice(0, 5000) ?? null,
      correction: input.correction?.slice(0, 2000) ?? null,
      modelVersion: input.modelVersion ?? null,
    })
    .returning({ id: aiFeedback.id });

  // Update model accuracy metrics if model version provided
  if (input.modelVersion) {
    await updateModelMetrics(input.feature, input.modelVersion, rating >= 4);
  }

  log.info(
    { feature: input.feature, rating, feedbackType: input.feedbackType },
    "AI feedback submitted"
  );

  return row.id;
}

/**
 * Get aggregate feedback stats for an AI feature.
 */
export async function getFeatureStats(feature: AIFeature): Promise<FeedbackStats> {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      avgRating: sql<number>`AVG(rating)`,
      positive: sql<number>`SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)`,
    })
    .from(aiFeedback)
    .where(eq(aiFeedback.feature, feature));

  const total = Number(stats?.total ?? 0);
  const avgRating = Number(stats?.avgRating ?? 0);
  const positive = Number(stats?.positive ?? 0);

  // Check recent trend (last 7 days vs prior 7 days)
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeks = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [recent] = await db
    .select({ avg: sql<number>`AVG(rating)` })
    .from(aiFeedback)
    .where(and(eq(aiFeedback.feature, feature), gte(aiFeedback.createdAt, week)));

  const [prior] = await db
    .select({ avg: sql<number>`AVG(rating)` })
    .from(aiFeedback)
    .where(
      and(
        eq(aiFeedback.feature, feature),
        gte(aiFeedback.createdAt, twoWeeks),
        sql`${aiFeedback.createdAt} < ${week}`
      )
    );

  const recentAvg = Number(recent?.avg ?? 0);
  const priorAvg = Number(prior?.avg ?? 0);

  let recentTrend: "improving" | "stable" | "declining" = "stable";
  if (recentAvg > 0 && priorAvg > 0) {
    if (recentAvg - priorAvg > 0.3) recentTrend = "improving";
    else if (priorAvg - recentAvg > 0.3) recentTrend = "declining";
  }

  return {
    feature,
    totalFeedback: total,
    averageRating: Math.round(avgRating * 100) / 100,
    positiveRate: total > 0 ? Math.round((positive / total) * 100) : 0,
    recentTrend,
  };
}

/**
 * Get feedback stats for all AI features.
 */
export async function getAllFeatureStats(): Promise<FeedbackStats[]> {
  const features: AIFeature[] = ["routing", "conflicts", "deadlines", "predictions", "suggestions"];
  return Promise.all(features.map(getFeatureStats));
}

/**
 * Get recent feedback entries for review.
 */
export async function getRecentFeedback(
  feature?: AIFeature,
  limit = 20
) {
  const query = db
    .select()
    .from(aiFeedback)
    .orderBy(desc(aiFeedback.createdAt))
    .limit(limit);

  if (feature) {
    return query.where(eq(aiFeedback.feature, feature));
  }
  return query;
}

/**
 * Update model accuracy metrics based on feedback.
 */
async function updateModelMetrics(
  feature: string,
  version: string,
  isPositive: boolean
): Promise<void> {
  try {
    await db
      .update(aiModels)
      .set({
        totalPredictions: sql`total_predictions + 1`,
        correctPredictions: isPositive
          ? sql`correct_predictions + 1`
          : sql`correct_predictions`,
        accuracy: sql`CASE WHEN total_predictions > 0 THEN ROUND(CAST(correct_predictions AS REAL) / total_predictions * 100, 1) ELSE NULL END`,
      })
      .where(and(eq(aiModels.feature, feature), eq(aiModels.version, version)));
  } catch (err) {
    log.error({ err, feature, version }, "Failed to update model metrics");
  }
}
