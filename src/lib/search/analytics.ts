/**
 * Search analytics — track search queries, popular searches, zero-result queries.
 */
import { db } from "@/db";
import { searchAnalytics, searchSuggestions } from "@/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "search-analytics" });

export interface SearchAnalyticsEvent {
  userId?: string;
  query: string;
  mode: "fts" | "semantic" | "hybrid";
  filters?: Record<string, unknown>;
  resultCount: number;
  responseTimeMs: number;
}

/**
 * Record a search query for analytics.
 */
export async function trackSearch(event: SearchAnalyticsEvent): Promise<void> {
  try {
    await db.insert(searchAnalytics).values({
      id: randomUUID(),
      userId: event.userId,
      query: event.query.slice(0, 500),
      mode: event.mode,
      filters: event.filters ? JSON.stringify(event.filters) : null,
      resultCount: event.resultCount,
      responseTimeMs: event.responseTimeMs,
    });

    // Update suggestions frequency
    await updateSuggestionFrequency(event.query, event.resultCount);
  } catch (err) {
    log.warn({ err }, "Failed to track search analytics");
  }
}

/**
 * Record a click on a search result.
 */
export async function trackSearchClick(
  analyticsId: string,
  resultId: string,
  resultType: "project" | "proposal" | "comment"
): Promise<void> {
  try {
    await db
      .update(searchAnalytics)
      .set({
        clickedResultId: resultId,
        clickedResultType: resultType,
      })
      .where(eq(searchAnalytics.id, analyticsId));
  } catch (err) {
    log.warn({ err }, "Failed to track search click");
  }
}

/**
 * Update or insert search suggestion frequency.
 */
async function updateSuggestionFrequency(query: string, resultCount: number): Promise<void> {
  const normalized = query.toLowerCase().trim().slice(0, 200);
  if (normalized.length < 2) return;

  try {
    const existing = await db
      .select()
      .from(searchSuggestions)
      .where(eq(searchSuggestions.query, normalized))
      .limit(1);

    if (existing.length > 0) {
      const prev = existing[0];
      const newFreq = (prev.frequency ?? 0) + 1;
      const newAvg = Math.round(((prev.avgResults ?? 0) * (prev.frequency ?? 1) + resultCount) / newFreq);
      await db
        .update(searchSuggestions)
        .set({
          frequency: newFreq,
          avgResults: newAvg,
          lastSearchedAt: new Date(),
        })
        .where(eq(searchSuggestions.id, prev.id));
    } else {
      await db.insert(searchSuggestions).values({
        id: randomUUID(),
        query: normalized,
        frequency: 1,
        avgResults: resultCount,
      });
    }
  } catch (err) {
    log.warn({ err }, "Failed to update suggestion frequency");
  }
}

/**
 * Get popular search queries (for search analytics dashboard).
 */
export async function getPopularSearches(
  limit = 20,
  daysBack = 30
): Promise<Array<{ query: string; count: number; avgResults: number }>> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400;

  try {
    const rows = await db
      .select({
        query: searchAnalytics.query,
        count: sql<number>`COUNT(*)`.as("count"),
        avgResults: sql<number>`ROUND(AVG(${searchAnalytics.resultCount}))`.as("avg_results"),
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.createdAt, new Date(cutoff * 1000)))
      .groupBy(searchAnalytics.query)
      .orderBy(desc(sql`count`))
      .limit(limit);

    return rows.map((r) => ({
      query: r.query,
      count: r.count,
      avgResults: r.avgResults,
    }));
  } catch {
    return [];
  }
}

/**
 * Get zero-result searches (queries that returned no results).
 */
export async function getZeroResultSearches(
  limit = 20,
  daysBack = 30
): Promise<Array<{ query: string; count: number; lastSearched: number }>> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400;

  try {
    const rows = await db
      .select({
        query: searchAnalytics.query,
        count: sql<number>`COUNT(*)`.as("count"),
        lastSearched: sql<number>`MAX(${searchAnalytics.createdAt})`.as("last_searched"),
      })
      .from(searchAnalytics)
      .where(
        and(
          gte(searchAnalytics.createdAt, new Date(cutoff * 1000)),
          eq(searchAnalytics.resultCount, 0)
        )
      )
      .groupBy(searchAnalytics.query)
      .orderBy(desc(sql`count`))
      .limit(limit);

    return rows.map((r) => ({
      query: r.query,
      count: r.count,
      lastSearched: r.lastSearched,
    }));
  } catch {
    return [];
  }
}

/**
 * Get search analytics stats for admin dashboard.
 */
export async function getSearchStats(daysBack = 30): Promise<{
  totalSearches: number;
  uniqueQueries: number;
  avgResponseTime: number;
  zeroResultRate: number;
  clickThroughRate: number;
  searchesByMode: Record<string, number>;
}> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400;

  try {
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`.as("total"),
        unique: sql<number>`COUNT(DISTINCT ${searchAnalytics.query})`.as("unique_queries"),
        avgTime: sql<number>`ROUND(AVG(${searchAnalytics.responseTimeMs}))`.as("avg_time"),
        zeroResults: sql<number>`SUM(CASE WHEN ${searchAnalytics.resultCount} = 0 THEN 1 ELSE 0 END)`.as("zero_results"),
        clicks: sql<number>`SUM(CASE WHEN ${searchAnalytics.clickedResultId} IS NOT NULL THEN 1 ELSE 0 END)`.as("clicks"),
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.createdAt, new Date(cutoff * 1000)));

    const modeRows = await db
      .select({
        mode: searchAnalytics.mode,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.createdAt, new Date(cutoff * 1000)))
      .groupBy(searchAnalytics.mode);

    const searchesByMode: Record<string, number> = {};
    for (const row of modeRows) {
      searchesByMode[row.mode] = row.count;
    }

    return {
      totalSearches: stats?.total ?? 0,
      uniqueQueries: stats?.unique ?? 0,
      avgResponseTime: stats?.avgTime ?? 0,
      zeroResultRate: stats?.total ? ((stats?.zeroResults ?? 0) / stats.total) * 100 : 0,
      clickThroughRate: stats?.total ? ((stats?.clicks ?? 0) / stats.total) * 100 : 0,
      searchesByMode,
    };
  } catch {
    return {
      totalSearches: 0,
      uniqueQueries: 0,
      avgResponseTime: 0,
      zeroResultRate: 0,
      clickThroughRate: 0,
      searchesByMode: {},
    };
  }
}
