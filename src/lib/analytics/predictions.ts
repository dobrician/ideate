/**
 * Predictive Success Scoring — predicts proposal approval likelihood.
 * Uses historical data patterns: early vote velocity, author track record,
 * content engagement, and project context to estimate success probability.
 */

import { db } from "@/db";
import { proposals, votes, comments, projects } from "@/db/schema";
import { eq, gte, sql, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "predictions" });

export interface SuccessFactor {
  name: string;
  score: number; // 0-100
  weight: number;
  description: string;
}

export interface SuccessPrediction {
  proposalId: string;
  proposalTitle: string;
  projectId: string;
  projectTitle: string;
  probability: number; // 0-100 likelihood of success
  confidence: number; // 0-100 how confident the prediction is
  factors: SuccessFactor[];
  prediction: "likely" | "uncertain" | "unlikely";
}

/**
 * Predict success likelihood for a proposal.
 */
export async function predictSuccess(
  proposalId: string
): Promise<SuccessPrediction | null> {
  try {
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
        userId: proposals.userId,
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

    const factors = await computeFactors(proposal);

    const weightedSum = factors.reduce(
      (sum, f) => sum + f.score * f.weight,
      0
    );
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const probability =
      totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    // Confidence based on amount of data available
    const dataPoints = factors.filter((f) => f.score > 0).length;
    const confidence = Math.min(100, Math.round((dataPoints / factors.length) * 80 + 20));

    let prediction: "likely" | "uncertain" | "unlikely" = "uncertain";
    if (probability >= 65) prediction = "likely";
    else if (probability <= 35) prediction = "unlikely";

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      projectId: proposal.projectId,
      projectTitle: project?.title ?? "Unknown Project",
      probability,
      confidence,
      factors,
      prediction,
    };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to predict success");
    return null;
  }
}

/**
 * Get predictions for all proposals in a project.
 */
export async function getProjectPredictions(
  projectId: string,
  limit = 20
): Promise<SuccessPrediction[]> {
  try {
    const projectProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.projectId, projectId))
      .limit(limit);

    const results: SuccessPrediction[] = [];
    for (const p of projectProposals) {
      const pred = await predictSuccess(p.id);
      if (pred) results.push(pred);
    }

    return results.sort((a, b) => b.probability - a.probability);
  } catch (err) {
    log.error({ err, projectId }, "Failed to get project predictions");
    return [];
  }
}

/**
 * Get platform-wide prediction summary for recently active proposals.
 */
export async function getPredictionSummary(
  limit = 20
): Promise<{
  predictions: SuccessPrediction[];
  averageAccuracy: number;
  generatedAt: string;
}> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const activeProposals = await db
      .select({
        proposalId: votes.proposalId,
        count: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .where(gte(votes.createdAt, cutoff))
      .groupBy(votes.proposalId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit * 2);

    const predictions: SuccessPrediction[] = [];
    for (const ap of activeProposals) {
      const pred = await predictSuccess(ap.proposalId);
      if (pred) predictions.push(pred);
    }

    const sorted = predictions
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);

    const avgAccuracy =
      sorted.length > 0
        ? round2(sorted.reduce((s, p) => s + p.confidence, 0) / sorted.length)
        : 0;

    return {
      predictions: sorted,
      averageAccuracy: avgAccuracy,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err }, "Failed to get prediction summary");
    return {
      predictions: [],
      averageAccuracy: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "analytics-predictions";

export function registerPredictionHandlers(): void {
  registerHandler(JOB_TYPE, handlePredictionJob);
}

export async function enqueuePredictionJob(
  projectId: string
): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handlePredictionJob(
  payload: Record<string, unknown>
): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) {
    throw new Error("Missing projectId in prediction job payload");
  }

  const predictions = await getProjectPredictions(projectId);
  log.info(
    { projectId, count: predictions.length },
    "Prediction analysis completed"
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────

interface ProposalData {
  id: string;
  title: string;
  projectId: string;
  userId: string | null;
  createdAt: Date | null;
}

async function computeFactors(proposal: ProposalData): Promise<SuccessFactor[]> {
  const factors: SuccessFactor[] = [];

  // Factor 1: Early vote ratio (pro vs contra in first 7 days)
  const earlyVoteScore = await getEarlyVoteScore(proposal.id, proposal.createdAt);
  factors.push({
    name: "Early Vote Sentiment",
    score: earlyVoteScore,
    weight: 0.3,
    description: "Ratio of positive to negative votes in the first week",
  });

  // Factor 2: Engagement level (total activity)
  const engagementScore = await getEngagementScore(proposal.id);
  factors.push({
    name: "Engagement Level",
    score: engagementScore,
    weight: 0.25,
    description: "Total votes and comments received",
  });

  // Factor 3: Author track record
  const authorScore = await getAuthorScore(proposal.userId);
  factors.push({
    name: "Author Track Record",
    score: authorScore,
    weight: 0.2,
    description: "Historical success rate of proposals by this author",
  });

  // Factor 4: Discussion quality (comment depth and diversity)
  const discussionScore = await getDiscussionScore(proposal.id);
  factors.push({
    name: "Discussion Quality",
    score: discussionScore,
    weight: 0.15,
    description: "Depth and diversity of comments and replies",
  });

  // Factor 5: Recency bonus
  const ageMs = Date.now() - (proposal.createdAt?.getTime() ?? Date.now());
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const recencyScore = Math.max(0, Math.round(100 * Math.exp(-ageDays / 60)));
  factors.push({
    name: "Recency",
    score: recencyScore,
    weight: 0.1,
    description: "How recently the proposal was created",
  });

  return factors;
}

async function getEarlyVoteScore(
  proposalId: string,
  createdAt: Date | null
): Promise<number> {
  try {
    const startDate = createdAt ?? new Date();
    const earlyEnd = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [voteData] = await db
      .select({
        pro: sql<number>`SUM(CASE WHEN value > 0 THEN 1 ELSE 0 END)`,
        contra: sql<number>`SUM(CASE WHEN value < 0 THEN 1 ELSE 0 END)`,
      })
      .from(votes)
      .where(
        sql`${votes.proposalId} = ${proposalId} AND ${votes.createdAt} <= ${earlyEnd}`
      );

    const pro = Number(voteData?.pro ?? 0);
    const contra = Number(voteData?.contra ?? 0);
    const total = pro + contra;

    if (total === 0) return 50; // No data = neutral
    return Math.round((pro / total) * 100);
  } catch {
    return 50;
  }
}

async function getEngagementScore(proposalId: string): Promise<number> {
  try {
    const [voteCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .where(eq(votes.proposalId, proposalId));

    const [commentCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(comments)
      .where(eq(comments.proposalId, proposalId));

    const v = Number(voteCount?.count ?? 0);
    const c = Number(commentCount?.count ?? 0);

    // Score: votes * 5 + comments * 10, capped at 100
    return Math.min(100, v * 5 + c * 10);
  } catch {
    return 0;
  }
}

async function getAuthorScore(userId: string | null): Promise<number> {
  if (!userId) return 50;

  try {
    // Single aggregated query: join votes with proposals by author
    const [result] = await db
      .select({
        pro: sql<number>`SUM(CASE WHEN ${votes.value} > 0 THEN 1 ELSE 0 END)`,
        contra: sql<number>`SUM(CASE WHEN ${votes.value} < 0 THEN 1 ELSE 0 END)`,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.userId, userId));

    const totalPositive = Number(result?.pro ?? 0);
    const totalNegative = Number(result?.contra ?? 0);
    const total = totalPositive + totalNegative;

    if (total === 0) return 50;
    return Math.round((totalPositive / total) * 100);
  } catch {
    return 50;
  }
}

async function getDiscussionScore(proposalId: string): Promise<number> {
  try {
    const [commentData] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        withReplies: sql<number>`SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END)`,
        uniqueAuthors: sql<number>`COUNT(DISTINCT user_id)`,
      })
      .from(comments)
      .where(eq(comments.proposalId, proposalId));

    const total = Number(commentData?.total ?? 0);
    const replies = Number(commentData?.withReplies ?? 0);
    const authors = Number(commentData?.uniqueAuthors ?? 0);

    if (total === 0) return 0;

    // Score: depth (replies ratio) + diversity (unique authors)
    const depthRatio = total > 0 ? replies / total : 0;
    const diversityScore = Math.min(50, authors * 10);
    const depthScore = Math.round(depthRatio * 50);

    return Math.min(100, depthScore + diversityScore);
  } catch {
    return 0;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
