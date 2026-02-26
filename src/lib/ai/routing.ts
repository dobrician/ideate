/**
 * Smart Proposal Routing — suggests optimal project assignments for proposals.
 * Uses embedding similarity to match proposal content against project descriptions.
 * Falls back to keyword overlap when embeddings are unavailable.
 */

import { db } from "@/db";
import { projects, proposals } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import {
  generateEmbedding,
  getEmbedding,
  cosineSimilarity,
  getEmbeddingsByType,
} from "@/lib/embeddings";
import { completeWithFallback } from "@/lib/llm";
import { logger } from "@/lib/logger";
import { enqueue, registerHandler } from "@/lib/queue";

const log = logger.child({ module: "ai-routing" });

export interface RoutingSuggestion {
  projectId: string;
  projectTitle: string;
  score: number;
  reason: string;
}

/**
 * Get project routing suggestions for a proposal.
 * Combines embedding similarity with LLM reasoning.
 */
export async function getRoutingSuggestions(
  proposalTitle: string,
  proposalDescription: string | null,
  currentProjectId?: string,
  limit = 5
): Promise<RoutingSuggestion[]> {
  try {
    const text = `${proposalTitle}\n${proposalDescription ?? ""}`.trim();
    if (!text) return [];

    const allProjects = await db
      .select({
        id: projects.id,
        title: projects.title,
        description: projects.description,
        status: projects.status,
      })
      .from(projects)
      .limit(100);

    const activeProjects = allProjects.filter(
      (p) => p.status === "active" && p.id !== currentProjectId
    );

    if (activeProjects.length === 0) return [];

    // Try embedding-based routing first
    const embeddingResults = await embeddingBasedRouting(text, activeProjects, limit);
    if (embeddingResults.length > 0) return embeddingResults;

    // Fallback to keyword-based routing
    return keywordBasedRouting(text, activeProjects, limit);
  } catch (err) {
    log.error({ err }, "Routing suggestion generation failed");
    return [];
  }
}

/**
 * Embedding-based routing using cosine similarity.
 */
async function embeddingBasedRouting(
  proposalText: string,
  activeProjects: Array<{ id: string; title: string; description: string | null }>,
  limit: number
): Promise<RoutingSuggestion[]> {
  try {
    const { vector: proposalVector } = await generateEmbedding(proposalText);
    const projectEmbeddings = await getEmbeddingsByType("project");

    if (projectEmbeddings.length === 0) return [];

    const projectEmbMap = new Map(
      projectEmbeddings.map((e) => [e.entityId, e.vector])
    );

    const scored = activeProjects
      .map((p) => {
        const pVector = projectEmbMap.get(p.id);
        if (!pVector || pVector.length !== proposalVector.length) return null;
        const score = cosineSimilarity(proposalVector, pVector);
        return { project: p, score };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => ({
      projectId: s.project.id,
      projectTitle: s.project.title,
      score: Math.round(s.score * 100) / 100,
      reason: "Content similarity based on semantic analysis",
    }));
  } catch (err) {
    log.warn({ err }, "Embedding-based routing failed");
    return [];
  }
}

/**
 * Keyword-based routing fallback using token overlap.
 */
function keywordBasedRouting(
  proposalText: string,
  activeProjects: Array<{ id: string; title: string; description: string | null }>,
  limit: number
): RoutingSuggestion[] {
  const proposalTokens = tokenize(proposalText);
  if (proposalTokens.size === 0) return [];

  const scored = activeProjects
    .map((p) => {
      const projectText = `${p.title}\n${p.description ?? ""}`;
      const projectTokens = tokenize(projectText);
      const intersection = new Set(
        [...proposalTokens].filter((t) => projectTokens.has(t))
      );
      const union = new Set([...proposalTokens, ...projectTokens]);
      const score = union.size > 0 ? intersection.size / union.size : 0;
      return { project: p, score };
    })
    .filter((r) => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => ({
    projectId: s.project.id,
    projectTitle: s.project.title,
    score: Math.round(s.score * 100) / 100,
    reason: "Keyword overlap between proposal and project",
  }));
}

/**
 * Tokenize text into a set of lowercase words for Jaccard comparison.
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Get routing suggestions for an existing proposal by ID.
 */
export async function getRoutingForProposal(
  proposalId: string,
  limit = 5
): Promise<RoutingSuggestion[]> {
  const [proposal] = await db
    .select({
      title: proposals.title,
      description: proposals.description,
      projectId: proposals.projectId,
    })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!proposal) return [];

  return getRoutingSuggestions(
    proposal.title,
    proposal.description,
    proposal.projectId,
    limit
  );
}

// ─── Job Queue Integration ──────────────────────────────────────────────

const JOB_TYPE = "ai-routing";

/** Register the routing job handler with the queue system. */
export function registerRoutingHandlers(): void {
  registerHandler(JOB_TYPE, handleRoutingJob);
}

/** Enqueue an async routing analysis job. */
export async function enqueueRoutingJob(proposalId: string): Promise<string> {
  return enqueue(JOB_TYPE, { proposalId });
}

/** Job handler: compute and log routing suggestions for a proposal. */
async function handleRoutingJob(payload: Record<string, unknown>): Promise<void> {
  const proposalId = payload.proposalId as string;
  if (!proposalId) throw new Error("Missing proposalId in routing job payload");

  const suggestions = await getRoutingForProposal(proposalId);
  log.info(
    { proposalId, suggestionsCount: suggestions.length },
    "Routing analysis completed"
  );
}
