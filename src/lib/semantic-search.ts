/**
 * Semantic search module — extends FTS5 search with embedding-based similarity.
 * Falls back to FTS5 when embeddings are unavailable.
 */

import { search as ftsSearch } from "@/lib/search";
import {
  generateEmbedding,
  getEmbedding,
  findSimilar,
  cosineSimilarity,
  getEmbeddingsByType,
} from "@/lib/embeddings";
import { db } from "@/db";
import { projects, proposals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "semantic-search" });

export interface SemanticSearchResult {
  id: string;
  title: string;
  description: string | null;
  type: "project" | "proposal" | "comment";
  snippet: string;
  projectId?: string;
  score: number;
  method: "fts" | "semantic" | "hybrid";
}

export interface SemanticSearchOptions {
  mode?: "fts" | "semantic" | "hybrid";
  limit?: number;
}

/**
 * Search across projects, proposals, and comments.
 * Supports FTS5, semantic (embedding), or hybrid modes.
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult[]> {
  const { mode = "hybrid", limit = 20 } = options;

  if (!query || query.trim().length < 2) return [];

  if (mode === "fts") {
    return ftsOnlySearch(query, limit);
  }

  if (mode === "semantic") {
    return semanticOnlySearch(query, limit);
  }

  // Hybrid: merge FTS and semantic results
  return hybridSearch(query, limit);
}

/**
 * FTS-only search with normalized scores.
 */
function ftsOnlySearch(query: string, limit: number): SemanticSearchResult[] {
  const ftsResults = ftsSearch(query, limit);
  return ftsResults.map((r, i) => ({
    ...r,
    score: 1 - i / Math.max(ftsResults.length, 1),
    method: "fts" as const,
  }));
}

/**
 * Semantic-only search using embeddings.
 */
async function semanticOnlySearch(
  query: string,
  limit: number
): Promise<SemanticSearchResult[]> {
  try {
    const { vector } = await generateEmbedding(query);

    const [projectMatches, proposalMatches] = await Promise.all([
      findSimilar(vector, "project", limit),
      findSimilar(vector, "proposal", limit),
    ]);

    const results: SemanticSearchResult[] = [];

    // Hydrate project matches
    for (const match of projectMatches) {
      if (match.score < 0.1) continue;
      const [row] = await db
        .select({ id: projects.id, title: projects.title, description: projects.description })
        .from(projects)
        .where(eq(projects.id, match.entityId))
        .limit(1);
      if (row) {
        results.push({
          id: row.id,
          title: row.title,
          description: row.description,
          type: "project",
          snippet: row.title,
          score: match.score,
          method: "semantic",
        });
      }
    }

    // Hydrate proposal matches
    for (const match of proposalMatches) {
      if (match.score < 0.1) continue;
      const [row] = await db
        .select({
          id: proposals.id,
          title: proposals.title,
          description: proposals.description,
          projectId: proposals.projectId,
        })
        .from(proposals)
        .where(eq(proposals.id, match.entityId))
        .limit(1);
      if (row) {
        results.push({
          id: row.id,
          title: row.title,
          description: row.description,
          type: "proposal",
          snippet: row.title,
          projectId: row.projectId,
          score: match.score,
          method: "semantic",
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    log.warn({ err }, "Semantic search failed, falling back to FTS");
    return ftsOnlySearch(query, limit);
  }
}

/**
 * Hybrid search: merge FTS5 keyword results with semantic similarity.
 * Uses reciprocal rank fusion to combine scores.
 */
async function hybridSearch(
  query: string,
  limit: number
): Promise<SemanticSearchResult[]> {
  // Run both searches in parallel
  const [ftsResults, semanticResults] = await Promise.all([
    Promise.resolve(ftsOnlySearch(query, limit)),
    semanticOnlySearch(query, limit).catch(() => []),
  ]);

  // Merge using reciprocal rank fusion (RRF)
  const RRF_K = 60;
  const scoreMap = new Map<string, { result: SemanticSearchResult; rrfScore: number }>();

  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i];
    const key = `${r.type}:${r.id}`;
    const existing = scoreMap.get(key);
    const rrfScore = 1 / (RRF_K + i + 1);
    if (existing) {
      existing.rrfScore += rrfScore;
      existing.result.method = "hybrid";
    } else {
      scoreMap.set(key, { result: { ...r, method: "hybrid" }, rrfScore });
    }
  }

  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i];
    const key = `${r.type}:${r.id}`;
    const existing = scoreMap.get(key);
    const rrfScore = 1 / (RRF_K + i + 1);
    if (existing) {
      existing.rrfScore += rrfScore;
      existing.result.method = "hybrid";
    } else {
      scoreMap.set(key, { result: { ...r, method: "hybrid" }, rrfScore });
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((entry) => ({ ...entry.result, score: entry.rrfScore }));
}

/**
 * Find proposals semantically similar to a given proposal.
 * Used for "similar proposals" feature on proposal pages.
 */
export async function findSimilarProposals(
  proposalId: string,
  limit = 5
): Promise<Array<{ id: string; title: string; score: number; projectId: string }>> {
  try {
    const embedding = await getEmbedding("proposal", proposalId);
    if (!embedding) return [];

    const matches = await findSimilar(embedding.vector, "proposal", limit, proposalId);

    const results: Array<{ id: string; title: string; score: number; projectId: string }> = [];
    for (const match of matches) {
      if (match.score < 0.1) continue;
      const [row] = await db
        .select({ id: proposals.id, title: proposals.title, projectId: proposals.projectId })
        .from(proposals)
        .where(eq(proposals.id, match.entityId))
        .limit(1);
      if (row) {
        results.push({
          id: row.id,
          title: row.title,
          score: match.score,
          projectId: row.projectId,
        });
      }
    }
    return results;
  } catch (err) {
    log.warn({ err, proposalId }, "Similar proposals lookup failed");
    return [];
  }
}
