/**
 * Automated Insight Generation — detects patterns in project data
 * and generates actionable insights.
 *
 * Insight types:
 * - trend: voting/activity trends (rising/declining engagement)
 * - bottleneck: stalled proposals, long review cycles
 * - recommendation: process improvements, suggested actions
 * - anomaly: unusual voting patterns, sudden activity changes
 */

import { db } from "@/db";
import { aiInsights, proposals, votes, comments, projects } from "@/db/schema";
import { eq, sql, desc, gte, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "ai-insights" });

export type InsightType = "trend" | "bottleneck" | "recommendation" | "anomaly";
export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  id: string;
  projectId: string | null;
  insightType: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  data: Record<string, unknown> | null;
  status: "active" | "dismissed" | "resolved";
  createdAt: Date | null;
}

/**
 * Generate insights for a specific project.
 */
export async function generateProjectInsights(projectId: string): Promise<Insight[]> {
  const generated: Insight[] = [];

  try {
    const [stalled, lowEngagement, activeProposals] = await Promise.all([
      detectStalledProposals(projectId),
      detectLowEngagement(projectId),
      detectActivityTrend(projectId),
    ]);

    for (const insight of [...stalled, ...lowEngagement, ...activeProposals]) {
      const [row] = await db
        .insert(aiInsights)
        .values({
          projectId,
          insightType: insight.insightType,
          title: insight.title,
          description: insight.description,
          severity: insight.severity,
          data: insight.data ? JSON.stringify(insight.data) : null,
        })
        .returning();

      generated.push({
        ...row,
        data: insight.data,
        insightType: row.insightType as InsightType,
        severity: row.severity as InsightSeverity,
        status: row.status as "active" | "dismissed" | "resolved",
      });
    }

    log.info({ projectId, count: generated.length }, "Insights generated");
  } catch (err) {
    log.error({ err, projectId }, "Failed to generate insights");
  }

  return generated;
}

/**
 * Get active insights for a project.
 */
export async function getProjectInsights(
  projectId: string,
  limit = 20
): Promise<Insight[]> {
  const rows = await db
    .select()
    .from(aiInsights)
    .where(and(eq(aiInsights.projectId, projectId), eq(aiInsights.status, "active")))
    .orderBy(desc(aiInsights.createdAt))
    .limit(limit);

  return rows.map(r => ({
    ...r,
    data: r.data ? JSON.parse(r.data) : null,
    insightType: r.insightType as InsightType,
    severity: r.severity as InsightSeverity,
    status: r.status as "active" | "dismissed" | "resolved",
  }));
}

/**
 * Dismiss an insight.
 */
export async function dismissInsight(insightId: string, userId: string): Promise<void> {
  await db
    .update(aiInsights)
    .set({ status: "dismissed", dismissedBy: userId })
    .where(eq(aiInsights.id, insightId));
}

/**
 * Get platform-wide insight summary.
 */
export async function getInsightSummary(): Promise<{
  total: number;
  byType: Record<InsightType, number>;
  bySeverity: Record<InsightSeverity, number>;
}> {
  const rows = await db
    .select({
      type: aiInsights.insightType,
      severity: aiInsights.severity,
      count: sql<number>`COUNT(*)`,
    })
    .from(aiInsights)
    .where(eq(aiInsights.status, "active"))
    .groupBy(aiInsights.insightType, aiInsights.severity);

  const byType: Record<InsightType, number> = { trend: 0, bottleneck: 0, recommendation: 0, anomaly: 0 };
  const bySeverity: Record<InsightSeverity, number> = { info: 0, warning: 0, critical: 0 };
  let total = 0;

  for (const row of rows) {
    const count = Number(row.count);
    total += count;
    byType[row.type as InsightType] = (byType[row.type as InsightType] ?? 0) + count;
    bySeverity[row.severity as InsightSeverity] = (bySeverity[row.severity as InsightSeverity] ?? 0) + count;
  }

  return { total, byType, bySeverity };
}

// ─── Insight Detectors ──────────────────────────────────────────────────

interface RawInsight {
  insightType: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  data: Record<string, unknown> | null;
}

async function detectStalledProposals(projectId: string): Promise<RawInsight[]> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days
  const results: RawInsight[] = [];

  try {
    const stalled = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        createdAt: proposals.createdAt,
        voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.proposal_id = ${proposals.id})`,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.projectId, projectId),
          sql`${proposals.createdAt} < ${cutoff}`
        )
      )
      .limit(10);

    for (const p of stalled) {
      const vc = Number(p.voteCount);
      if (vc < 3) {
        results.push({
          insightType: "bottleneck",
          title: `Stalled: "${p.title}"`,
          description: `This proposal has been open for over 2 weeks with only ${vc} vote(s). Consider promoting it or closing it.`,
          severity: vc === 0 ? "warning" : "info",
          data: { proposalId: p.id, voteCount: vc, daysSinceCreation: Math.floor((Date.now() - (p.createdAt?.getTime() ?? 0)) / 86400000) },
        });
      }
    }
  } catch (err) {
    log.error({ err }, "detectStalledProposals failed");
  }

  return results;
}

async function detectLowEngagement(projectId: string): Promise<RawInsight[]> {
  const results: RawInsight[] = [];

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recent] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(and(eq(proposals.projectId, projectId), gte(votes.createdAt, thirtyDaysAgo)));

    const [prior] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(
        and(
          eq(proposals.projectId, projectId),
          gte(votes.createdAt, sixtyDaysAgo),
          sql`${votes.createdAt} < ${thirtyDaysAgo}`
        )
      );

    const recentCount = Number(recent?.count ?? 0);
    const priorCount = Number(prior?.count ?? 0);

    if (priorCount > 5 && recentCount < priorCount * 0.5) {
      results.push({
        insightType: "trend",
        title: "Declining engagement",
        description: `Voting activity dropped ${Math.round((1 - recentCount / priorCount) * 100)}% compared to last month. Consider re-engaging participants.`,
        severity: recentCount < priorCount * 0.25 ? "warning" : "info",
        data: { recentVotes: recentCount, priorVotes: priorCount },
      });
    }
  } catch (err) {
    log.error({ err }, "detectLowEngagement failed");
  }

  return results;
}

async function detectActivityTrend(projectId: string): Promise<RawInsight[]> {
  const results: RawInsight[] = [];

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentProposals] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(proposals)
      .where(and(eq(proposals.projectId, projectId), gte(proposals.createdAt, sevenDaysAgo)));

    const count = Number(recentProposals?.count ?? 0);
    if (count >= 5) {
      results.push({
        insightType: "trend",
        title: "High proposal activity",
        description: `${count} new proposals in the last 7 days. This project is seeing strong participation.`,
        severity: "info",
        data: { proposalCount: count, period: "7d" },
      });
    }
  } catch (err) {
    log.error({ err }, "detectActivityTrend failed");
  }

  return results;
}

// ─── Job Queue ──────────────────────────────────────────────────────────

const JOB_TYPE = "ai-insights";

export function registerInsightHandlers(): void {
  registerHandler(JOB_TYPE, handleInsightJob);
}

export async function enqueueInsightJob(projectId: string): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handleInsightJob(payload: Record<string, unknown>): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) throw new Error("Missing projectId");
  await generateProjectInsights(projectId);
}
