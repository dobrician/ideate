/**
 * Trend detection system.
 * Tracks keyword frequency, vote momentum, and discussion activity
 * to surface trending topics and proposals.
 */

import { db } from "@/db";
import { proposals, votes, comments, projects } from "@/db/schema";
import { desc, gte, sql, eq } from "drizzle-orm";
import { tokenize } from "@/lib/embeddings";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "trends" });

export interface TrendingTopic {
  keyword: string;
  frequency: number;
  growth: number; // Percentage growth vs previous period
}

export interface TrendingProposal {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  momentum: number;
  voteVelocity: number;
  commentActivity: number;
}

export interface TrendSnapshot {
  topics: TrendingTopic[];
  proposals: TrendingProposal[];
  generatedAt: string;
}

/**
 * Get trending topics from recent proposal content.
 * Analyzes keyword frequency in proposals created in the last N days.
 */
export async function getTrendingTopics(
  days = 7,
  limit = 20
): Promise<TrendingTopic[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const prevCutoff = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

    // Get recent proposals
    const recentProposals = await db
      .select({ title: proposals.title, description: proposals.description })
      .from(proposals)
      .where(gte(proposals.createdAt, cutoff));

    // Get previous period proposals for growth calculation
    const prevProposals = await db
      .select({ title: proposals.title, description: proposals.description })
      .from(proposals)
      .where(gte(proposals.createdAt, prevCutoff));

    const recentFreq = countKeywords(recentProposals);
    const prevFreq = countKeywords(prevProposals);

    // Calculate growth
    const topics: TrendingTopic[] = [];
    for (const [keyword, frequency] of recentFreq.entries()) {
      const prevCount = prevFreq.get(keyword) ?? 0;
      const growth = prevCount > 0
        ? Math.round(((frequency - prevCount) / prevCount) * 100)
        : frequency > 1 ? 100 : 0;

      topics.push({ keyword, frequency, growth });
    }

    return topics
      .filter((t) => t.frequency >= 2)
      .sort((a, b) => b.frequency - a.frequency || b.growth - a.growth)
      .slice(0, limit);
  } catch (err) {
    log.error({ err }, "Failed to get trending topics");
    return [];
  }
}

/**
 * Get trending proposals based on vote velocity and comment activity.
 * Measures momentum over the last N days.
 */
export async function getTrendingProposals(
  days = 7,
  limit = 10
): Promise<TrendingProposal[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get vote counts per proposal in the time window
    const recentVotes = await db
      .select({
        proposalId: votes.proposalId,
        voteCount: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .where(gte(votes.createdAt, cutoff))
      .groupBy(votes.proposalId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit * 3);

    // Get comment counts per proposal in the time window
    const recentComments = await db
      .select({
        proposalId: comments.proposalId,
        commentCount: sql<number>`COUNT(*)`,
      })
      .from(comments)
      .where(gte(comments.createdAt, cutoff))
      .groupBy(comments.proposalId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit * 3);

    // Merge vote and comment activity into momentum score
    const momentumMap = new Map<string, { votes: number; comments: number }>();

    for (const v of recentVotes) {
      if (!v.proposalId) continue;
      const existing = momentumMap.get(v.proposalId) ?? { votes: 0, comments: 0 };
      existing.votes = Number(v.voteCount);
      momentumMap.set(v.proposalId, existing);
    }

    for (const c of recentComments) {
      if (!c.proposalId) continue;
      const existing = momentumMap.get(c.proposalId) ?? { votes: 0, comments: 0 };
      existing.comments = Number(c.commentCount);
      momentumMap.set(c.proposalId, existing);
    }

    // Calculate momentum: weighted combination of votes and comments
    const candidates = Array.from(momentumMap.entries())
      .map(([proposalId, activity]) => ({
        proposalId,
        momentum: activity.votes * 2 + activity.comments * 3,
        voteVelocity: activity.votes / days,
        commentActivity: activity.comments / days,
      }))
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, limit);

    // Hydrate with proposal and project details
    const results: TrendingProposal[] = [];
    for (const c of candidates) {
      const [proposal] = await db
        .select({
          id: proposals.id,
          title: proposals.title,
          projectId: proposals.projectId,
        })
        .from(proposals)
        .where(eq(proposals.id, c.proposalId))
        .limit(1);

      if (!proposal) continue;

      const [project] = await db
        .select({ title: projects.title })
        .from(projects)
        .where(eq(projects.id, proposal.projectId))
        .limit(1);

      results.push({
        id: proposal.id,
        title: proposal.title,
        projectId: proposal.projectId,
        projectTitle: project?.title ?? "Unknown Project",
        momentum: c.momentum,
        voteVelocity: Math.round(c.voteVelocity * 100) / 100,
        commentActivity: Math.round(c.commentActivity * 100) / 100,
      });
    }

    return results;
  } catch (err) {
    log.error({ err }, "Failed to get trending proposals");
    return [];
  }
}

/**
 * Get a complete trend snapshot including topics and proposals.
 */
export async function getTrendSnapshot(days = 7): Promise<TrendSnapshot> {
  const [topics, trendingProposals] = await Promise.all([
    getTrendingTopics(days),
    getTrendingProposals(days),
  ]);

  return {
    topics,
    proposals: trendingProposals,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────

/**
 * Count keyword frequency across proposals.
 */
function countKeywords(
  rows: Array<{ title: string; description: string | null }>
): Map<string, number> {
  const freq = new Map<string, number>();
  for (const row of rows) {
    const text = `${row.title} ${row.description ?? ""}`;
    const tokens = tokenize(text);
    const unique = new Set(tokens); // Count each keyword once per proposal
    for (const token of unique) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return freq;
}
