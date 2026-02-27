/**
 * Social Network Analysis — tracks user interaction patterns.
 * Analyzes voting patterns, comment interactions, and collaboration networks
 * to identify influential users and echo chambers.
 */

import { db } from "@/db";
import { users, votes, comments, proposals } from "@/db/schema";
import { eq, gte, sql, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "social" });

export interface UserNode {
  userId: string;
  name: string;
  proposalCount: number;
  voteCount: number;
  commentCount: number;
  influence: number; // 0-100 composite score
}

export interface InteractionEdge {
  sourceUserId: string;
  targetUserId: string;
  weight: number; // interaction strength
  type: "vote" | "comment" | "mixed";
}

export interface NetworkStats {
  totalUsers: number;
  activeUsers: number;
  averageConnections: number;
  density: number; // 0-1, ratio of actual to possible connections
}

export interface SocialNetwork {
  nodes: UserNode[];
  edges: InteractionEdge[];
  stats: NetworkStats;
  influencers: UserNode[];
  generatedAt: string;
}

/**
 * Build the social interaction network for the platform.
 * Analyzes who votes on whose proposals and who replies to whom.
 */
export async function buildSocialNetwork(
  days = 30,
  limit = 50
): Promise<SocialNetwork> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [userActivity, voteEdges, commentEdges] = await Promise.all([
      getUserActivity(cutoff, limit),
      getVoteInteractions(cutoff),
      getCommentInteractions(cutoff),
    ]);

    const nodes = userActivity;
    const edgeMap = new Map<string, InteractionEdge>();

    // Merge vote edges
    for (const edge of voteEdges) {
      const key = edgeKey(edge.sourceUserId, edge.targetUserId);
      const existing = edgeMap.get(key);
      if (existing) {
        existing.weight += edge.weight;
        existing.type = "mixed";
      } else {
        edgeMap.set(key, { ...edge });
      }
    }

    // Merge comment edges
    for (const edge of commentEdges) {
      const key = edgeKey(edge.sourceUserId, edge.targetUserId);
      const existing = edgeMap.get(key);
      if (existing) {
        existing.weight += edge.weight;
        existing.type = "mixed";
      } else {
        edgeMap.set(key, { ...edge });
      }
    }

    const edges = Array.from(edgeMap.values());
    const activeUsers = nodes.filter(
      (n) => n.proposalCount + n.voteCount + n.commentCount > 0
    ).length;

    const maxPossible =
      activeUsers > 1 ? (activeUsers * (activeUsers - 1)) / 2 : 1;
    const uniquePairs = new Set(edges.map((e) => edgeKey(e.sourceUserId, e.targetUserId)));

    const stats: NetworkStats = {
      totalUsers: nodes.length,
      activeUsers,
      averageConnections:
        activeUsers > 0 ? round2((edges.length * 2) / activeUsers) : 0,
      density: round2(uniquePairs.size / maxPossible),
    };

    const influencers = [...nodes]
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 10);

    return {
      nodes,
      edges,
      stats,
      influencers,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err }, "Failed to build social network");
    return {
      nodes: [],
      edges: [],
      stats: { totalUsers: 0, activeUsers: 0, averageConnections: 0, density: 0 },
      influencers: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get influence score for a specific user.
 */
export async function getUserInfluence(userId: string): Promise<UserNode | null> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    const [proposalCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(eq(proposals.userId, userId));

    const [voteCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(eq(votes.userId, userId));

    const [commentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(eq(comments.userId, userId));

    const pCount = Number(proposalCount?.count ?? 0);
    const vCount = Number(voteCount?.count ?? 0);
    const cCount = Number(commentCount?.count ?? 0);

    return {
      userId: user.id,
      name: formatName(user.firstName, user.lastName),
      proposalCount: pCount,
      voteCount: vCount,
      commentCount: cCount,
      influence: computeInfluence(pCount, vCount, cCount),
    };
  } catch (err) {
    log.error({ err, userId }, "Failed to get user influence");
    return null;
  }
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "analytics-social";

export function registerSocialHandlers(): void {
  registerHandler(JOB_TYPE, handleSocialJob);
}

export async function enqueueSocialAnalysis(): Promise<string> {
  return enqueue(JOB_TYPE, {});
}

async function handleSocialJob(): Promise<void> {
  const network = await buildSocialNetwork();
  log.info(
    { nodes: network.nodes.length, edges: network.edges.length },
    "Social network analysis completed"
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────

async function getUserActivity(
  cutoff: Date,
  limit: number
): Promise<UserNode[]> {
  const userRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .limit(limit);

  const nodes: UserNode[] = [];
  for (const u of userRows) {
    const [pCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(eq(proposals.userId, u.id));

    const [vCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(eq(votes.userId, u.id));

    const [cCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(eq(comments.userId, u.id));

    const pc = Number(pCount?.count ?? 0);
    const vc = Number(vCount?.count ?? 0);
    const cc = Number(cCount?.count ?? 0);

    nodes.push({
      userId: u.id,
      name: formatName(u.firstName, u.lastName),
      proposalCount: pc,
      voteCount: vc,
      commentCount: cc,
      influence: computeInfluence(pc, vc, cc),
    });
  }

  return nodes;
}

async function getVoteInteractions(
  cutoff: Date
): Promise<InteractionEdge[]> {
  try {
    const interactions = await db
      .select({
        voterId: votes.userId,
        authorId: proposals.userId,
        count: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(gte(votes.createdAt, cutoff))
      .groupBy(votes.userId, proposals.userId);

    return interactions
      .filter((i) => i.authorId && i.voterId !== i.authorId)
      .map((i) => ({
        sourceUserId: i.voterId,
        targetUserId: i.authorId!,
        weight: Number(i.count),
        type: "vote" as const,
      }));
  } catch (err) {
    log.warn({ err }, "Failed to get vote interactions");
    return [];
  }
}

async function getCommentInteractions(
  cutoff: Date
): Promise<InteractionEdge[]> {
  try {
    // Find reply chains: who replies to whose comments
    const interactions = await db
      .select({
        replierId: comments.userId,
        parentAuthorId: sql<string>`parent.user_id`,
        count: sql<number>`COUNT(*)`,
      })
      .from(comments)
      .innerJoin(
        sql`comments AS parent`,
        eq(comments.parentId, sql`parent.id`)
      )
      .where(gte(comments.createdAt, cutoff))
      .groupBy(comments.userId, sql`parent.user_id`);

    return interactions
      .filter(
        (i) =>
          i.parentAuthorId &&
          i.replierId &&
          i.replierId !== i.parentAuthorId
      )
      .map((i) => ({
        sourceUserId: i.replierId!,
        targetUserId: i.parentAuthorId,
        weight: Number(i.count) * 2, // Comments weighted higher
        type: "comment" as const,
      }));
  } catch (err) {
    log.warn({ err }, "Failed to get comment interactions");
    return [];
  }
}

/**
 * Compute influence score (0-100) from activity counts.
 * Proposals weighted 5x, comments 2x, votes 1x.
 * Capped at 100 using logarithmic scaling.
 */
function computeInfluence(
  proposalCount: number,
  voteCount: number,
  commentCount: number
): number {
  const raw = proposalCount * 5 + commentCount * 2 + voteCount;
  // Log scale: influence = min(100, 20 * ln(1 + raw))
  return Math.min(100, Math.round(20 * Math.log(1 + raw)));
}

function formatName(
  firstName: string | null,
  lastName: string | null
): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Anonymous";
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
