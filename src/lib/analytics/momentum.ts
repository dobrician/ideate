/**
 * Proposal Momentum Scoring — combined velocity, comment activity, and time decay.
 * Produces a single momentum score for ranking proposals by engagement intensity.
 */

import { db } from "@/db";
import { proposals, votes, comments, projects } from "@/db/schema";
import { eq, gte, sql, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "momentum" });

export interface MomentumScore {
  proposalId: string;
  proposalTitle: string;
  projectId: string;
  projectTitle: string;
  score: number; // 0-100 composite momentum
  voteComponent: number;
  commentComponent: number;
  recencyComponent: number;
  trend: "rising" | "stable" | "falling";
}

export interface MomentumSnapshot {
  proposals: MomentumScore[];
  averageMomentum: number;
  generatedAt: string;
}

/**
 * Calculate momentum score for a single proposal.
 */
export async function getProposalMomentum(
  proposalId: string
): Promise<MomentumScore | null> {
  try {
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
        createdAt: proposals.createdAt,
      })
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) return null;

    const [project] = await db
      .select({ title: projects.title })
      .from(projects)
      .where(eq(projects.id, proposal.projectId))
      .limit(1);

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const olderCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Recent vote count (last 7 days)
    const [recentVotes] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(
        sql`${votes.proposalId} = ${proposalId} AND ${votes.createdAt} >= ${recentCutoff}`
      );

    // Older vote count (7-14 days ago)
    const [olderVotes] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(
        sql`${votes.proposalId} = ${proposalId} AND ${votes.createdAt} >= ${olderCutoff} AND ${votes.createdAt} < ${recentCutoff}`
      );

    // Recent comment count
    const [recentComments] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(
        sql`${comments.proposalId} = ${proposalId} AND ${comments.createdAt} >= ${recentCutoff}`
      );

    // Older comment count
    const [olderComments] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(
        sql`${comments.proposalId} = ${proposalId} AND ${comments.createdAt} >= ${olderCutoff} AND ${comments.createdAt} < ${recentCutoff}`
      );

    const rv = Number(recentVotes?.count ?? 0);
    const ov = Number(olderVotes?.count ?? 0);
    const rc = Number(recentComments?.count ?? 0);
    const oc = Number(olderComments?.count ?? 0);

    // Compute components (each 0-100 scale)
    const voteComponent = Math.min(100, rv * 10);
    const commentComponent = Math.min(100, rc * 15);

    // Recency: how old is the proposal? Newer = higher score
    const ageMs = Date.now() - (proposal.createdAt?.getTime() ?? Date.now());
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    const recencyComponent = Math.max(0, Math.round(100 * Math.exp(-ageDays / 30)));

    // Combined score: weighted average
    const score = Math.min(
      100,
      Math.round(voteComponent * 0.4 + commentComponent * 0.35 + recencyComponent * 0.25)
    );

    // Determine trend
    const recentActivity = rv + rc;
    const olderActivity = ov + oc;
    let trend: "rising" | "stable" | "falling" = "stable";
    if (recentActivity > olderActivity * 1.2) trend = "rising";
    else if (recentActivity < olderActivity * 0.8) trend = "falling";

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      projectId: proposal.projectId,
      projectTitle: project?.title ?? "Unknown Project",
      score,
      voteComponent: round2(voteComponent),
      commentComponent: round2(commentComponent),
      recencyComponent: round2(recencyComponent),
      trend,
    };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to calculate proposal momentum");
    return null;
  }
}

/**
 * Get momentum scores for all proposals in a project, sorted by score.
 */
export async function getProjectMomentum(
  projectId: string,
  limit = 20
): Promise<MomentumScore[]> {
  try {
    const projectProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.projectId, projectId))
      .limit(limit);

    const results: MomentumScore[] = [];
    for (const p of projectProposals) {
      const momentum = await getProposalMomentum(p.id);
      if (momentum) results.push(momentum);
    }

    return results.sort((a, b) => b.score - a.score);
  } catch (err) {
    log.error({ err, projectId }, "Failed to get project momentum");
    return [];
  }
}

/**
 * Get platform-wide momentum snapshot with top proposals.
 */
export async function getMomentumSnapshot(
  limit = 20
): Promise<MomentumSnapshot> {
  try {
    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find proposals with recent activity
    const activeProposals = await db
      .select({
        proposalId: votes.proposalId,
        count: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .where(gte(votes.createdAt, recentCutoff))
      .groupBy(votes.proposalId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit * 2);

    const scores: MomentumScore[] = [];
    for (const ap of activeProposals) {
      const m = await getProposalMomentum(ap.proposalId);
      if (m) scores.push(m);
    }

    const sorted = scores.sort((a, b) => b.score - a.score).slice(0, limit);
    const avgMomentum =
      sorted.length > 0
        ? round2(sorted.reduce((sum, s) => sum + s.score, 0) / sorted.length)
        : 0;

    return {
      proposals: sorted,
      averageMomentum: avgMomentum,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err }, "Failed to get momentum snapshot");
    return {
      proposals: [],
      averageMomentum: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "analytics-momentum";

export function registerMomentumHandlers(): void {
  registerHandler(JOB_TYPE, handleMomentumJob);
}

export async function enqueueMomentumJob(
  projectId: string
): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handleMomentumJob(
  payload: Record<string, unknown>
): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) {
    throw new Error("Missing projectId in momentum job payload");
  }

  const momentum = await getProjectMomentum(projectId);
  log.info(
    { projectId, proposalCount: momentum.length },
    "Momentum analysis completed"
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
