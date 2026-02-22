/**
 * Content recommendations module.
 * Generates proposal recommendations based on user voting history
 * and content similarity via embeddings.
 */

import { db } from "@/db";
import { votes, proposals, projects } from "@/db/schema";
import { eq, and, desc, ne, notInArray } from "drizzle-orm";
import {
  getEmbedding,
  getEmbeddingsByType,
  cosineSimilarity,
} from "@/lib/embeddings";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "recommendations" });

export interface Recommendation {
  proposalId: string;
  proposalTitle: string;
  projectId: string;
  projectTitle: string;
  score: number;
  reason: "similar_content" | "voting_pattern" | "popular";
}

/**
 * Get proposal recommendations for a user.
 * Strategy: combine content similarity with user voting patterns.
 */
export async function getRecommendations(
  userId: string,
  limit = 10
): Promise<Recommendation[]> {
  try {
    const [contentRecs, patternRecs, popularRecs] = await Promise.all([
      getContentBasedRecommendations(userId, limit),
      getVotingPatternRecommendations(userId, limit),
      getPopularRecommendations(userId, limit),
    ]);

    // Merge and deduplicate, preferring higher-scored entries
    const seen = new Map<string, Recommendation>();

    for (const rec of [...contentRecs, ...patternRecs, ...popularRecs]) {
      const existing = seen.get(rec.proposalId);
      if (!existing || existing.score < rec.score) {
        seen.set(rec.proposalId, rec);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    log.error({ err, userId }, "Recommendation generation failed");
    return [];
  }
}

/**
 * Content-based recommendations using embeddings.
 * Finds proposals similar to those the user has voted positively on.
 */
async function getContentBasedRecommendations(
  userId: string,
  limit: number
): Promise<Recommendation[]> {
  // Get proposals the user voted +1 on
  const likedVotes = await db
    .select({ proposalId: votes.proposalId })
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.value, 1)))
    .limit(20);

  if (likedVotes.length === 0) return [];

  const likedIds = new Set(likedVotes.map((v) => v.proposalId));

  // Get all voted proposal IDs (to exclude from recommendations)
  const allVotes = await db
    .select({ proposalId: votes.proposalId })
    .from(votes)
    .where(eq(votes.userId, userId));
  const votedIds = new Set(allVotes.map((v) => v.proposalId));

  // Get embeddings for liked proposals
  const likedEmbeddings: number[][] = [];
  for (const v of likedVotes.slice(0, 5)) {
    const emb = await getEmbedding("proposal", v.proposalId);
    if (emb) likedEmbeddings.push(emb.vector);
  }

  if (likedEmbeddings.length === 0) return [];

  // Average the liked embeddings to create a user preference vector
  const dims = likedEmbeddings[0].length;
  const avgVector = new Array(dims).fill(0);
  for (const emb of likedEmbeddings) {
    for (let i = 0; i < dims; i++) {
      avgVector[i] += emb[i] / likedEmbeddings.length;
    }
  }

  // Find similar proposals
  const allProposalEmbeddings = await getEmbeddingsByType("proposal");
  const candidates = allProposalEmbeddings
    .filter((e) => !votedIds.has(e.entityId) && e.vector.length === dims)
    .map((e) => ({
      entityId: e.entityId,
      score: cosineSimilarity(avgVector, e.vector),
    }))
    .filter((c) => c.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return hydrateProposalRecommendations(candidates, "similar_content");
}

/**
 * Voting pattern recommendations.
 * Finds proposals that users with similar voting patterns liked.
 */
async function getVotingPatternRecommendations(
  userId: string,
  limit: number
): Promise<Recommendation[]> {
  // Get the user's positive votes
  const userVotes = await db
    .select({ proposalId: votes.proposalId })
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.value, 1)));

  if (userVotes.length === 0) return [];

  const userLikedIds = userVotes.map((v) => v.proposalId);

  // Find other users who also liked the same proposals
  const similarUserVotes = await db
    .select({ userId: votes.userId, proposalId: votes.proposalId })
    .from(votes)
    .where(
      and(
        ne(votes.userId, userId),
        eq(votes.value, 1),
      )
    )
    .limit(200);

  // Count overlap with current user
  const userOverlap = new Map<string, number>();
  for (const v of similarUserVotes) {
    if (userLikedIds.includes(v.proposalId)) {
      userOverlap.set(v.userId, (userOverlap.get(v.userId) ?? 0) + 1);
    }
  }

  // Get top similar users (by overlap count)
  const topUsers = Array.from(userOverlap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid]) => uid);

  if (topUsers.length === 0) return [];

  // Get proposals liked by similar users but not yet voted by current user
  const allUserVotes = await db
    .select({ proposalId: votes.proposalId })
    .from(votes)
    .where(eq(votes.userId, userId));
  const alreadyVoted = new Set(allUserVotes.map((v) => v.proposalId));

  const recCandidates = new Map<string, number>();
  for (const v of similarUserVotes) {
    if (topUsers.includes(v.userId) && !alreadyVoted.has(v.proposalId)) {
      recCandidates.set(
        v.proposalId,
        (recCandidates.get(v.proposalId) ?? 0) + 1
      );
    }
  }

  const candidates = Array.from(recCandidates.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([proposalId, count]) => ({
      entityId: proposalId,
      score: Math.min(count / topUsers.length, 1),
    }));

  return hydrateProposalRecommendations(candidates, "voting_pattern");
}

/**
 * Popular recommendations fallback.
 * Returns recent popular proposals the user hasn't voted on.
 */
async function getPopularRecommendations(
  userId: string,
  limit: number
): Promise<Recommendation[]> {
  // Get proposals the user already voted on
  const userVotes = await db
    .select({ proposalId: votes.proposalId })
    .from(votes)
    .where(eq(votes.userId, userId));
  const votedIds = userVotes.map((v) => v.proposalId);

  // Get recent proposals not yet voted by user, from active projects
  let query = db
    .select({
      id: proposals.id,
      title: proposals.title,
      projectId: proposals.projectId,
    })
    .from(proposals)
    .orderBy(desc(proposals.createdAt))
    .limit(limit * 2);

  const recentProposals = await query;

  const candidates = recentProposals
    .filter((p) => !votedIds.includes(p.id))
    .slice(0, limit);

  const results: Recommendation[] = [];
  for (const p of candidates) {
    const [proj] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, p.projectId))
      .limit(1);

    results.push({
      proposalId: p.id,
      proposalTitle: p.title,
      projectId: p.projectId,
      projectTitle: proj?.title ?? "Unknown Project",
      score: 0.3, // Low baseline score for popular items
      reason: "popular",
    });
  }

  return results;
}

/**
 * Hydrate proposal IDs into full recommendation objects.
 */
async function hydrateProposalRecommendations(
  candidates: Array<{ entityId: string; score: number }>,
  reason: "similar_content" | "voting_pattern"
): Promise<Recommendation[]> {
  const results: Recommendation[] = [];

  for (const c of candidates) {
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
      })
      .from(proposals)
      .where(eq(proposals.id, c.entityId))
      .limit(1);

    if (!proposal) continue;

    const [project] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, proposal.projectId))
      .limit(1);

    results.push({
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      projectId: proposal.projectId,
      projectTitle: project?.title ?? "Unknown Project",
      score: c.score,
      reason,
    });
  }

  return results;
}
