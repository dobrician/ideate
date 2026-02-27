/**
 * Vote Velocity Tracking — tracks vote accumulation rates over time.
 * Measures how quickly proposals gain votes and identifies acceleration patterns.
 * Stores velocity snapshots for trend analysis.
 */

import { db } from "@/db";
import { votes, proposals, projects } from "@/db/schema";
import { eq, gte, sql, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "velocity" });

export interface VelocityPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  cumulative: number;
  dailyRate: number;
}

export interface ProposalVelocity {
  proposalId: string;
  proposalTitle: string;
  projectId: string;
  projectTitle: string;
  totalVotes: number;
  currentRate: number; // votes per day over last 7 days
  peakRate: number; // highest daily rate observed
  acceleration: number; // change in rate (positive = speeding up)
  timeline: VelocityPoint[];
}

export interface VelocitySummary {
  fastestGrowing: ProposalVelocity[];
  decelerating: ProposalVelocity[];
  generatedAt: string;
}

/**
 * Get vote velocity data for a specific proposal.
 * Builds a daily timeline of vote accumulation.
 */
export async function getProposalVelocity(
  proposalId: string,
  days = 30
): Promise<ProposalVelocity | null> {
  try {
    const [proposal] = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        projectId: proposals.projectId,
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

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const dailyVotes = await db
      .select({
        date: sql<string>`DATE(created_at, 'unixepoch')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .where(eq(votes.proposalId, proposalId))
      .groupBy(sql`DATE(created_at, 'unixepoch')`)
      .orderBy(sql`DATE(created_at, 'unixepoch')`);

    const timeline = buildTimeline(dailyVotes, days);
    const currentRate = computeRate(timeline, 7);
    const previousRate = computeRate(timeline, 14, 7);
    const peakRate = Math.max(...timeline.map((p) => p.dailyRate), 0);
    const totalVotes = timeline.length > 0
      ? timeline[timeline.length - 1].cumulative
      : 0;

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      projectId: proposal.projectId,
      projectTitle: project?.title ?? "Unknown Project",
      totalVotes,
      currentRate: round2(currentRate),
      peakRate: round2(peakRate),
      acceleration: round2(currentRate - previousRate),
      timeline,
    };
  } catch (err) {
    log.error({ err, proposalId }, "Failed to get proposal velocity");
    return null;
  }
}

/**
 * Get velocity data for all proposals in a project.
 */
export async function getProjectVelocities(
  projectId: string,
  days = 30,
  limit = 20
): Promise<ProposalVelocity[]> {
  try {
    const projectProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.projectId, projectId))
      .limit(limit);

    const results: ProposalVelocity[] = [];
    for (const p of projectProposals) {
      const velocity = await getProposalVelocity(p.id, days);
      if (velocity) results.push(velocity);
    }

    return results.sort((a, b) => b.currentRate - a.currentRate);
  } catch (err) {
    log.error({ err, projectId }, "Failed to get project velocities");
    return [];
  }
}

/**
 * Get a platform-wide velocity summary: fastest growing and decelerating proposals.
 */
export async function getVelocitySummary(
  days = 30,
  limit = 10
): Promise<VelocitySummary> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find proposals with recent votes
    const activeProposals = await db
      .select({
        proposalId: votes.proposalId,
        voteCount: sql<number>`COUNT(*)`,
      })
      .from(votes)
      .where(gte(votes.createdAt, cutoff))
      .groupBy(votes.proposalId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit * 3);

    const velocities: ProposalVelocity[] = [];
    for (const ap of activeProposals) {
      const v = await getProposalVelocity(ap.proposalId, days);
      if (v) velocities.push(v);
    }

    const fastestGrowing = velocities
      .filter((v) => v.acceleration > 0)
      .sort((a, b) => b.acceleration - a.acceleration)
      .slice(0, limit);

    const decelerating = velocities
      .filter((v) => v.acceleration < 0)
      .sort((a, b) => a.acceleration - b.acceleration)
      .slice(0, limit);

    return {
      fastestGrowing,
      decelerating,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err }, "Failed to get velocity summary");
    return {
      fastestGrowing: [],
      decelerating: [],
      generatedAt: new Date().toISOString(),
    };
  }
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "analytics-velocity";

export function registerVelocityHandlers(): void {
  registerHandler(JOB_TYPE, handleVelocityJob);
}

export async function enqueueVelocityJob(
  proposalId: string
): Promise<string> {
  return enqueue(JOB_TYPE, { proposalId });
}

async function handleVelocityJob(
  payload: Record<string, unknown>
): Promise<void> {
  const proposalId = payload.proposalId as string;
  if (!proposalId) {
    throw new Error("Missing proposalId in velocity job payload");
  }

  const velocity = await getProposalVelocity(proposalId);
  log.info(
    { proposalId, currentRate: velocity?.currentRate ?? 0 },
    "Velocity analysis completed"
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────

function buildTimeline(
  dailyVotes: Array<{ date: string; count: number }>,
  days: number
): VelocityPoint[] {
  const timeline: VelocityPoint[] = [];
  let cumulative = 0;

  for (const dv of dailyVotes) {
    cumulative += Number(dv.count);
    timeline.push({
      date: dv.date,
      cumulative,
      dailyRate: Number(dv.count),
    });
  }

  return timeline;
}

function computeRate(
  timeline: VelocityPoint[],
  recentDays: number,
  offsetDays = 0
): number {
  if (timeline.length === 0) return 0;

  const now = Date.now();
  const start = now - recentDays * 24 * 60 * 60 * 1000;
  const end = offsetDays > 0
    ? now - offsetDays * 24 * 60 * 60 * 1000
    : now;

  const points = timeline.filter((p) => {
    const ts = new Date(p.date).getTime();
    return ts >= start && ts <= end;
  });

  const totalVotes = points.reduce((sum, p) => sum + p.dailyRate, 0);
  const windowDays = recentDays - offsetDays;
  return windowDays > 0 ? totalVotes / windowDays : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
