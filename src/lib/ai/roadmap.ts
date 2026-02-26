/**
 * Auto-generated Roadmaps — generates project roadmaps from proposals.
 * Clusters proposals into milestones using embeddings and voting data.
 * Falls back to chronological grouping when embeddings unavailable.
 */

import { db } from "@/db";
import { projects, proposals, votes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getEmbeddingsByType,
  cosineSimilarity,
} from "@/lib/embeddings";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "ai-roadmap" });

export interface RoadmapMilestone {
  id: number;
  title: string;
  proposals: RoadmapProposal[];
  estimatedCompletion: string | null;
}

export interface RoadmapProposal {
  id: string;
  title: string;
  voteScore: number;
  createdAt: string;
}

export interface Roadmap {
  projectId: string;
  projectTitle: string;
  milestones: RoadmapMilestone[];
  generatedAt: string;
}

/**
 * Generate a roadmap for a project.
 * Clusters proposals into milestones by semantic similarity,
 * ordered by vote priority within each milestone.
 */
export async function generateRoadmap(
  projectId: string
): Promise<Roadmap | null> {
  try {
    const [project] = await db
      .select({
        id: projects.id,
        title: projects.title,
        deadline: projects.deadline,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return null;

    // Get proposals with vote scores
    const projectProposals = await getProposalsWithScores(projectId);
    if (projectProposals.length === 0) {
      return {
        projectId: project.id,
        projectTitle: project.title,
        milestones: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // Cluster proposals into milestones
    const clusters = await clusterProposals(projectProposals);

    // Build milestones
    const milestones = clusters.map((cluster, idx) => {
      const sorted = cluster.sort((a, b) => b.voteScore - a.voteScore);
      const milestone: RoadmapMilestone = {
        id: idx + 1,
        title: generateMilestoneTitle(sorted),
        proposals: sorted.map((p) => ({
          id: p.id,
          title: p.title,
          voteScore: p.voteScore,
          createdAt: p.createdAt,
        })),
        estimatedCompletion: estimateMilestoneDate(
          project.deadline,
          project.createdAt,
          idx,
          clusters.length
        ),
      };
      return milestone;
    });

    return {
      projectId: project.id,
      projectTitle: project.title,
      milestones,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err, projectId }, "Roadmap generation failed");
    return null;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────

interface ProposalWithScore {
  id: string;
  title: string;
  description: string | null;
  voteScore: number;
  createdAt: string;
}

async function getProposalsWithScores(projectId: string): Promise<ProposalWithScore[]> {
  const projectProposals = await db
    .select({
      id: proposals.id,
      title: proposals.title,
      description: proposals.description,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.projectId, projectId));

  const results: ProposalWithScore[] = [];
  for (const p of projectProposals) {
    const [voteResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(value), 0)` })
      .from(votes)
      .where(eq(votes.proposalId, p.id));

    results.push({
      id: p.id,
      title: p.title,
      description: p.description,
      voteScore: Number(voteResult?.total ?? 0),
      createdAt: p.createdAt instanceof Date
        ? p.createdAt.toISOString()
        : new Date((p.createdAt as unknown as number) * 1000).toISOString(),
    });
  }

  return results;
}

/**
 * Cluster proposals using embedding similarity.
 * Falls back to size-based grouping.
 */
async function clusterProposals(
  proposalList: ProposalWithScore[]
): Promise<ProposalWithScore[][]> {
  if (proposalList.length <= 3) {
    return [proposalList];
  }

  try {
    const embeddingData = await getEmbeddingsByType("proposal");
    const embMap = new Map(embeddingData.map((e) => [e.entityId, e.vector]));

    // Check if we have enough embeddings
    const proposalsWithEmb = proposalList.filter((p) => embMap.has(p.id));
    if (proposalsWithEmb.length < 2) {
      return chronologicalClustering(proposalList);
    }

    // Simple agglomerative clustering
    return embeddingClustering(proposalList, embMap);
  } catch {
    return chronologicalClustering(proposalList);
  }
}

/**
 * Cluster proposals using embedding similarity (simple k-means-like approach).
 */
function embeddingClustering(
  proposalList: ProposalWithScore[],
  embMap: Map<string, number[]>
): ProposalWithScore[][] {
  const targetClusters = Math.min(Math.ceil(proposalList.length / 3), 5);

  // Initialize: assign each proposal to a cluster using modular assignment of sorted proposals
  const sorted = [...proposalList].sort((a, b) => b.voteScore - a.voteScore);
  const clusters: ProposalWithScore[][] = Array.from({ length: targetClusters }, () => []);

  // Assign proposals to clusters based on similarity
  const assigned = new Set<string>();
  const seeds: string[] = [];

  // Pick seeds: highest-voted proposals that are most different from each other
  for (const p of sorted) {
    if (seeds.length >= targetClusters) break;
    const pVec = embMap.get(p.id);
    if (!pVec) continue;

    const isFarEnough = seeds.every((seedId) => {
      const seedVec = embMap.get(seedId);
      if (!seedVec || seedVec.length !== pVec.length) return true;
      return cosineSimilarity(pVec, seedVec) < 0.7;
    });

    if (isFarEnough || seeds.length === 0) {
      seeds.push(p.id);
    }
  }

  // If we don't have enough seeds, fall back
  if (seeds.length < 2) {
    return chronologicalClustering(proposalList);
  }

  // Assign each proposal to nearest seed
  for (const p of proposalList) {
    const pVec = embMap.get(p.id);
    let bestCluster = 0;
    let bestSim = -1;

    for (let i = 0; i < seeds.length; i++) {
      const seedVec = embMap.get(seeds[i]);
      if (!pVec || !seedVec || pVec.length !== seedVec.length) continue;
      const sim = cosineSimilarity(pVec, seedVec);
      if (sim > bestSim) {
        bestSim = sim;
        bestCluster = i;
      }
    }

    clusters[bestCluster].push(p);
    assigned.add(p.id);
  }

  // Add unassigned proposals to the first non-empty cluster
  for (const p of proposalList) {
    if (!assigned.has(p.id)) {
      clusters[0].push(p);
    }
  }

  return clusters.filter((c) => c.length > 0);
}

/**
 * Fallback: group proposals chronologically into milestones.
 */
function chronologicalClustering(proposalList: ProposalWithScore[]): ProposalWithScore[][] {
  const sorted = [...proposalList].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const clusterSize = Math.max(3, Math.ceil(sorted.length / 4));
  const clusters: ProposalWithScore[][] = [];

  for (let i = 0; i < sorted.length; i += clusterSize) {
    clusters.push(sorted.slice(i, i + clusterSize));
  }

  return clusters;
}

/**
 * Generate a descriptive title for a milestone from its proposals.
 */
function generateMilestoneTitle(clusterProposals: ProposalWithScore[]): string {
  if (clusterProposals.length === 0) return "Milestone";
  if (clusterProposals.length === 1) return clusterProposals[0].title;

  // Use the highest-voted proposal's title as the milestone name
  const topProposal = clusterProposals[0]; // already sorted by voteScore
  return topProposal.title;
}

/**
 * Estimate completion date for a milestone based on project timeline.
 */
function estimateMilestoneDate(
  deadline: Date | unknown,
  createdAt: Date | unknown,
  milestoneIndex: number,
  totalMilestones: number
): string | null {
  if (!deadline || !createdAt || totalMilestones === 0) return null;

  try {
    const start = createdAt instanceof Date ? createdAt.getTime() : Number(createdAt) * 1000;
    const end = deadline instanceof Date ? deadline.getTime() : Number(deadline) * 1000;
    const duration = end - start;
    const milestoneTime = start + (duration * (milestoneIndex + 1)) / totalMilestones;
    return new Date(milestoneTime).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "ai-roadmap";

/** Register the roadmap generation job handler. */
export function registerRoadmapHandlers(): void {
  registerHandler(JOB_TYPE, handleRoadmapJob);
}

/** Enqueue a roadmap generation job. */
export async function enqueueRoadmapGeneration(projectId: string): Promise<string> {
  return enqueue(JOB_TYPE, { projectId });
}

async function handleRoadmapJob(payload: Record<string, unknown>): Promise<void> {
  const projectId = payload.projectId as string;
  if (!projectId) throw new Error("Missing projectId in roadmap job payload");

  const roadmap = await generateRoadmap(projectId);
  log.info(
    { projectId, milestoneCount: roadmap?.milestones.length ?? 0 },
    "Roadmap generation completed"
  );
}
