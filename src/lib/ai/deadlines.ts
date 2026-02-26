/**
 * Predictive Deadline Analysis — suggests realistic deadlines for projects.
 * Analyzes historical project durations and proposal activity patterns.
 * Provides "deadline health" indicators for existing projects.
 */

import { db } from "@/db";
import { projects, proposals, votes, comments } from "@/db/schema";
import { eq, sql, lte, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "ai-deadlines" });

export type DeadlineHealth = "onTrack" | "atRisk" | "overdue";

export interface DeadlinePrediction {
  suggestedDeadline: Date;
  confidence: number;
  basedOnCount: number;
  reasoning: string;
}

export interface DeadlineHealthResult {
  projectId: string;
  health: DeadlineHealth;
  daysRemaining: number;
  activityScore: number;
  proposalCount: number;
  voteCount: number;
  completionEstimate: number;
}

/**
 * Predict a realistic deadline for a new project based on historical data.
 */
export async function predictDeadline(
  projectTitle: string,
  proposalCountEstimate?: number
): Promise<DeadlinePrediction> {
  try {
    const historicalDurations = await getHistoricalDurations();

    if (historicalDurations.length === 0) {
      // Default: 14 days from now
      const defaultDeadline = new Date(Date.now() + 14 * DAY_MS);
      return {
        suggestedDeadline: defaultDeadline,
        confidence: 20,
        basedOnCount: 0,
        reasoning: "No historical data available; using 14-day default",
      };
    }

    // Calculate weighted median duration
    const durations = historicalDurations.map((d) => d.durationDays);
    durations.sort((a, b) => a - b);
    const medianDuration = durations[Math.floor(durations.length / 2)];

    // Adjust based on estimated proposal count
    let adjustedDuration = medianDuration;
    if (proposalCountEstimate) {
      const avgProposalsPerProject = await getAvgProposalsPerProject();
      if (avgProposalsPerProject > 0) {
        const ratio = proposalCountEstimate / avgProposalsPerProject;
        adjustedDuration = Math.round(medianDuration * Math.max(0.5, Math.min(ratio, 2.0)));
      }
    }

    // Ensure minimum 3 days, maximum 90 days
    adjustedDuration = Math.max(3, Math.min(adjustedDuration, 90));

    const suggestedDeadline = new Date(Date.now() + adjustedDuration * DAY_MS);
    const confidence = Math.min(30 + historicalDurations.length * 5, 90);

    return {
      suggestedDeadline,
      confidence,
      basedOnCount: historicalDurations.length,
      reasoning: `Based on ${historicalDurations.length} historical project(s) with median duration of ${medianDuration} days`,
    };
  } catch (err) {
    log.error({ err }, "Deadline prediction failed");
    const defaultDeadline = new Date(Date.now() + 14 * DAY_MS);
    return {
      suggestedDeadline: defaultDeadline,
      confidence: 10,
      basedOnCount: 0,
      reasoning: "Prediction failed; using 14-day default",
    };
  }
}

/**
 * Assess the "health" of a project's deadline.
 * Combines time remaining with activity metrics.
 */
export async function assessDeadlineHealth(
  projectId: string
): Promise<DeadlineHealthResult | null> {
  try {
    const [project] = await db
      .select({
        id: projects.id,
        deadline: projects.deadline,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || !project.deadline) return null;

    const now = new Date();
    const deadlineDate = project.deadline instanceof Date ? project.deadline : new Date(project.deadline as unknown as number * 1000);
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / DAY_MS);

    // Get activity metrics
    const [proposalStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(eq(proposals.projectId, projectId));

    const [voteStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .where(eq(proposals.projectId, projectId));

    const proposalCount = Number(proposalStats?.count ?? 0);
    const voteCount = Number(voteStats?.count ?? 0);

    // Activity score: normalized engagement per day
    const createdDate = project.createdAt instanceof Date ? project.createdAt : new Date((project.createdAt as unknown as number) * 1000);
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - createdDate.getTime()) / DAY_MS));
    const activityScore = Math.min((proposalCount + voteCount) / daysElapsed, 10);

    // Determine health
    let health: DeadlineHealth;
    if (daysRemaining < 0) {
      health = "overdue";
    } else if (daysRemaining <= 3 && proposalCount === 0) {
      health = "atRisk";
    } else if (daysRemaining <= 7 && activityScore < 0.5) {
      health = "atRisk";
    } else {
      health = "onTrack";
    }

    // Completion estimate: based on current activity trajectory
    const totalDuration = daysElapsed + Math.max(daysRemaining, 0);
    const completionEstimate = totalDuration > 0
      ? Math.min(Math.round((daysElapsed / totalDuration) * 100), 100)
      : 0;

    return {
      projectId,
      health,
      daysRemaining,
      activityScore: Math.round(activityScore * 100) / 100,
      proposalCount,
      voteCount,
      completionEstimate,
    };
  } catch (err) {
    log.error({ err, projectId }, "Deadline health assessment failed");
    return null;
  }
}

/**
 * Get deadline health for all active projects.
 */
export async function getAllDeadlineHealth(): Promise<DeadlineHealthResult[]> {
  const activeProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.status, "active"));

  const results: DeadlineHealthResult[] = [];
  for (const p of activeProjects) {
    const health = await assessDeadlineHealth(p.id);
    if (health) results.push(health);
  }
  return results;
}

// ─── Internal helpers ─────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

interface HistoricalDuration {
  projectId: string;
  durationDays: number;
}

async function getHistoricalDurations(): Promise<HistoricalDuration[]> {
  // Get archived/completed projects with both created and deadline dates
  const archivedProjects = await db
    .select({
      id: projects.id,
      createdAt: projects.createdAt,
      deadline: projects.deadline,
    })
    .from(projects)
    .where(eq(projects.status, "archived"));

  return archivedProjects
    .filter((p) => p.createdAt && p.deadline)
    .map((p) => {
      const created = p.createdAt instanceof Date ? p.createdAt : new Date((p.createdAt as unknown as number) * 1000);
      const deadline = p.deadline instanceof Date ? p.deadline : new Date((p.deadline as unknown as number) * 1000);
      const durationDays = Math.max(1, Math.ceil((deadline.getTime() - created.getTime()) / DAY_MS));
      return { projectId: p.id, durationDays };
    })
    .filter((d) => d.durationDays > 0 && d.durationDays < 365);
}

async function getAvgProposalsPerProject(): Promise<number> {
  const [result] = await db
    .select({
      avg: sql<number>`CAST(COUNT(${proposals.id}) AS FLOAT) / MAX(1, COUNT(DISTINCT ${proposals.projectId}))`,
    })
    .from(proposals);
  return Number(result?.avg ?? 0);
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "ai-deadline-analysis";

/** Register the deadline analysis job handler. */
export function registerDeadlineHandlers(): void {
  registerHandler(JOB_TYPE, handleDeadlineJob);
}

/** Enqueue a deadline health analysis job. */
export async function enqueueDeadlineAnalysis(projectId: string): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handleDeadlineJob(payload: Record<string, unknown>): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) throw new Error("Missing projectId in deadline job payload");

  const health = await assessDeadlineHealth(projectId);
  log.info(
    { projectId, health: health?.health, daysRemaining: health?.daysRemaining },
    "Deadline analysis completed"
  );
}
