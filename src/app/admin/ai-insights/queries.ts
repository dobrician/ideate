/**
 * Data queries for the AI Insights dashboard.
 * Fetches AI job stats, deadline health, and feature metrics.
 */

import { db } from "@/db";
import { jobQueue, projects, embeddings } from "@/db/schema";
import { sql, eq, desc, like } from "drizzle-orm";
import { getAllDeadlineHealth } from "@/lib/ai/deadlines";

export interface AiInsightsData {
  jobStats: {
    routing: JobTypeStat;
    conflicts: JobTypeStat;
    deadlines: JobTypeStat;
    roadmaps: JobTypeStat;
    embeddings: JobTypeStat;
  };
  deadlineHealth: {
    onTrack: number;
    atRisk: number;
    overdue: number;
  };
  embeddingCount: number;
  recentJobs: RecentJob[];
}

interface JobTypeStat {
  total: number;
  completed: number;
  failed: number;
}

export interface RecentJob {
  id: string;
  type: string;
  status: string;
  createdAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
}

async function getJobTypeStats(typePrefix: string): Promise<JobTypeStat> {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status IN ('failed', 'dead') THEN 1 ELSE 0 END)`,
    })
    .from(jobQueue)
    .where(like(jobQueue.type, `${typePrefix}%`));

  return {
    total: Number(stats?.total ?? 0),
    completed: Number(stats?.completed ?? 0),
    failed: Number(stats?.failed ?? 0),
  };
}

export async function getAiInsightsData(): Promise<AiInsightsData> {
  const [routing, conflicts, deadlines, roadmaps, embeddingsJobs] = await Promise.all([
    getJobTypeStats("ai-routing"),
    getJobTypeStats("ai-conflict"),
    getJobTypeStats("ai-deadline"),
    getJobTypeStats("ai-roadmap"),
    getJobTypeStats("generate-embedding"),
  ]);

  // Deadline health summary
  let deadlineHealth = { onTrack: 0, atRisk: 0, overdue: 0 };
  try {
    const allHealth = await getAllDeadlineHealth();
    for (const h of allHealth) {
      deadlineHealth[h.health]++;
    }
  } catch {
    // Ignore — dashboard still renders with zeros
  }

  // Embedding count
  const [embCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(embeddings);

  // Recent AI jobs
  const recentJobs = await db
    .select({
      id: jobQueue.id,
      type: jobQueue.type,
      status: jobQueue.status,
      createdAt: jobQueue.createdAt,
      completedAt: jobQueue.completedAt,
      lastError: jobQueue.lastError,
    })
    .from(jobQueue)
    .where(like(jobQueue.type, "ai-%"))
    .orderBy(desc(jobQueue.createdAt))
    .limit(20);

  return {
    jobStats: { routing, conflicts, deadlines, roadmaps, embeddings: embeddingsJobs },
    deadlineHealth,
    embeddingCount: Number(embCount?.count ?? 0),
    recentJobs: recentJobs.map((j) => ({
      ...j,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
    })),
  };
}
