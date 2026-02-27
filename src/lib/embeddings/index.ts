/**
 * Vector embeddings module for semantic search.
 * Supports OpenAI embeddings API with TF-IDF local fallback.
 * Embeddings are stored in SQLite as JSON-serialized float arrays.
 */

import { db } from "@/db";
import { embeddings, projects, proposals } from "@/db/schema";
import { eq, and, count, lte, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "embeddings" });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const OPENAI_EMBEDDING_ENDPOINT = "https://api.openai.com/v1/embeddings";

/** Default dimensions for TF-IDF local embeddings */
const TFIDF_DIMENSIONS = 256;

/** Check if OpenAI embeddings API is available */
export function isEmbeddingApiAvailable(): boolean {
  return !!OPENAI_KEY;
}

/**
 * Generate embedding vector via OpenAI API.
 * Returns null if API unavailable or on error.
 */
export async function generateOpenAIEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY) return null;

  try {
    const response = await fetch(OPENAI_EMBEDDING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "OpenAI embedding request failed");
      return null;
    }

    const data = await response.json();
    const vector = data?.data?.[0]?.embedding;
    if (!Array.isArray(vector)) return null;
    return vector as number[];
  } catch (err) {
    log.error({ err }, "OpenAI embedding error");
    return null;
  }
}

/**
 * Generate a local TF-IDF-style embedding.
 * Uses deterministic hashing to map tokens into a fixed-dimensional vector.
 * This is a lightweight fallback when no API key is configured.
 */
export function generateLocalEmbedding(text: string): number[] {
  const tokens = tokenize(text);
  const vector = new Float64Array(TFIDF_DIMENSIONS);

  // Token frequency map
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Hash each token into vector positions with TF weighting
  for (const [token, count] of freq) {
    const tf = count / tokens.length;
    const hash = fnv1a(token);
    const idx = Math.abs(hash) % TFIDF_DIMENSIONS;
    // Use sign from second hash to allow negative values
    const sign = fnv1a(token + "_sign") % 2 === 0 ? 1 : -1;
    vector[idx] += sign * tf;
  }

  // L2 normalize
  return l2Normalize(Array.from(vector));
}

/**
 * Generate embedding for text, preferring OpenAI, falling back to local.
 */
export async function generateEmbedding(text: string): Promise<{ vector: number[]; model: string }> {
  const openaiVector = await generateOpenAIEmbedding(text);
  if (openaiVector) {
    return { vector: openaiVector, model: OPENAI_EMBEDDING_MODEL };
  }
  return { vector: generateLocalEmbedding(text), model: "tfidf" };
}

/**
 * Store an embedding for an entity. Replaces existing embedding if present.
 */
export async function storeEmbedding(
  entityType: "project" | "proposal" | "comment",
  entityId: string,
  vector: number[],
  model: string
): Promise<void> {
  const existing = await db
    .select({ id: embeddings.id })
    .from(embeddings)
    .where(and(eq(embeddings.entityType, entityType), eq(embeddings.entityId, entityId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(embeddings)
      .set({
        vector: JSON.stringify(vector),
        model,
        dimensions: vector.length,
        updatedAt: new Date(),
      })
      .where(eq(embeddings.id, existing[0].id));
  } else {
    await db.insert(embeddings).values({
      entityType,
      entityId,
      vector: JSON.stringify(vector),
      model,
      dimensions: vector.length,
    });
  }
}

/**
 * Retrieve the embedding vector for an entity.
 */
export async function getEmbedding(
  entityType: "project" | "proposal" | "comment",
  entityId: string
): Promise<{ vector: number[]; model: string } | null> {
  const [row] = await db
    .select({ vector: embeddings.vector, model: embeddings.model })
    .from(embeddings)
    .where(and(eq(embeddings.entityType, entityType), eq(embeddings.entityId, entityId)))
    .limit(1);

  if (!row) return null;
  try {
    return { vector: JSON.parse(row.vector) as number[], model: row.model };
  } catch {
    return null;
  }
}

/**
 * Retrieve all embeddings for a given entity type.
 */
export async function getEmbeddingsByType(
  entityType: "project" | "proposal" | "comment"
): Promise<Array<{ entityId: string; vector: number[]; model: string }>> {
  const rows = await db
    .select({
      entityId: embeddings.entityId,
      vector: embeddings.vector,
      model: embeddings.model,
    })
    .from(embeddings)
    .where(eq(embeddings.entityType, entityType));

  return rows
    .map((row) => {
      try {
        return {
          entityId: row.entityId,
          vector: JSON.parse(row.vector) as number[],
          model: row.model,
        };
      } catch {
        return null;
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Cosine similarity between two vectors.
 * Returns value in [-1, 1] range. Higher is more similar.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/**
 * Find the most similar entities to a given vector.
 */
export async function findSimilar(
  vector: number[],
  entityType: "project" | "proposal" | "comment",
  limit = 10,
  excludeId?: string
): Promise<Array<{ entityId: string; score: number }>> {
  const all = await getEmbeddingsByType(entityType);

  const scored = all
    .filter((e) => e.entityId !== excludeId)
    .filter((e) => e.vector.length === vector.length)
    .map((e) => ({
      entityId: e.entityId,
      score: cosineSimilarity(vector, e.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/** Get max embedding age in days from env, default 30 */
export function getEmbeddingMaxAgeDays(): number {
  const env = process.env.EMBEDDING_MAX_AGE_DAYS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 30;
}

/**
 * Get stale embeddings — embeddings whose updatedAt is older than maxAgeDays.
 */
export async function getStaleEmbeddings(
  maxAgeDays?: number,
  limit = 50
): Promise<Array<{ id: string; entityType: string; entityId: string; updatedAt: Date | null }>> {
  const ageDays = maxAgeDays ?? getEmbeddingMaxAgeDays();
  const cutoff = new Date(Date.now() - ageDays * 86400 * 1000);

  return db
    .select({
      id: embeddings.id,
      entityType: embeddings.entityType,
      entityId: embeddings.entityId,
      updatedAt: embeddings.updatedAt,
    })
    .from(embeddings)
    .where(lte(embeddings.updatedAt, cutoff))
    .limit(limit);
}

/**
 * Get embedding freshness statistics.
 */
export async function getEmbeddingFreshnessStats(): Promise<{
  fresh: number;
  stale: number;
  avgAgeDays: number;
}> {
  const maxAgeDays = getEmbeddingMaxAgeDays();
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400;

  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`.as("total"),
      staleCount: sql<number>`SUM(CASE WHEN ${embeddings.updatedAt} <= ${cutoff} THEN 1 ELSE 0 END)`.as("stale_count"),
      avgAge: sql<number>`ROUND(AVG((unixepoch() - ${embeddings.updatedAt}) / 86400.0), 1)`.as("avg_age"),
    })
    .from(embeddings);

  const total = stats?.total ?? 0;
  const stale = stats?.staleCount ?? 0;

  return {
    fresh: total - stale,
    stale,
    avgAgeDays: stats?.avgAge ?? 0,
  };
}

/**
 * Get embedding coverage statistics by entity type and model.
 */
export async function getEmbeddingStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
  entityTotals: Record<string, number>;
  apiAvailable: boolean;
  activeModel: string;
  freshness: { fresh: number; stale: number; avgAgeDays: number };
}> {
  const [rows, [projectCount], [proposalCount], freshness] = await Promise.all([
    db.select({ entityType: embeddings.entityType, model: embeddings.model }).from(embeddings),
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(proposals),
    getEmbeddingFreshnessStats(),
  ]);

  const byType: Record<string, number> = {};
  const byModel: Record<string, number> = {};

  for (const row of rows) {
    byType[row.entityType] = (byType[row.entityType] ?? 0) + 1;
    byModel[row.model] = (byModel[row.model] ?? 0) + 1;
  }

  return {
    total: rows.length,
    byType,
    byModel,
    entityTotals: {
      project: projectCount?.count ?? 0,
      proposal: proposalCount?.count ?? 0,
    },
    apiAvailable: isEmbeddingApiAvailable(),
    activeModel: isEmbeddingApiAvailable() ? OPENAI_EMBEDDING_MODEL : "tfidf",
    freshness,
  };
}

/**
 * Get model distribution — count of embeddings per model.
 */
export async function getModelDistribution(): Promise<
  Array<{ model: string; count: number; percentage: number }>
> {
  const rows = await db
    .select({
      model: embeddings.model,
      cnt: sql<number>`COUNT(*)`.as("cnt"),
    })
    .from(embeddings)
    .groupBy(embeddings.model);

  const total = rows.reduce((s, r) => s + r.cnt, 0);
  return rows.map((r) => ({
    model: r.model,
    count: r.cnt,
    percentage: total > 0 ? Math.round((r.cnt / total) * 100) : 0,
  }));
}

/**
 * Migrate embeddings to a target model by marking non-matching embeddings
 * as stale (resetting updatedAt to epoch) so the cron refresh picks them up.
 * Returns the number of embeddings queued for regeneration.
 */
export async function migrateEmbeddingModel(targetModel: string): Promise<{
  queued: number;
  alreadyCurrent: number;
}> {
  // Count already on target model
  const [current] = await db
    .select({ cnt: sql<number>`COUNT(*)`.as("cnt") })
    .from(embeddings)
    .where(eq(embeddings.model, targetModel));

  const [total] = await db
    .select({ cnt: sql<number>`COUNT(*)`.as("cnt") })
    .from(embeddings);

  const alreadyCurrent = current?.cnt ?? 0;
  const needsMigration = (total?.cnt ?? 0) - alreadyCurrent;

  if (needsMigration > 0) {
    // Mark non-target-model embeddings as stale by setting updatedAt to epoch
    const epoch = new Date(0);
    await db
      .update(embeddings)
      .set({ updatedAt: epoch })
      .where(sql`${embeddings.model} != ${targetModel}`);

    log.info({ targetModel, queued: needsMigration }, "Embedding model migration initiated");
  }

  return { queued: needsMigration, alreadyCurrent };
}

/**
 * Get current embedding migration status — how many are on target vs off-target.
 */
export async function getEmbeddingMigrationStatus(): Promise<{
  targetModel: string;
  onTarget: number;
  offTarget: number;
  total: number;
  progressPercent: number;
}> {
  const targetModel = isEmbeddingApiAvailable() ? OPENAI_EMBEDDING_MODEL : "tfidf";

  const [onTargetRow] = await db
    .select({ cnt: sql<number>`COUNT(*)`.as("cnt") })
    .from(embeddings)
    .where(eq(embeddings.model, targetModel));

  const [totalRow] = await db
    .select({ cnt: sql<number>`COUNT(*)`.as("cnt") })
    .from(embeddings);

  const onTarget = onTargetRow?.cnt ?? 0;
  const total = totalRow?.cnt ?? 0;
  const offTarget = total - onTarget;

  return {
    targetModel,
    onTarget,
    offTarget,
    total,
    progressPercent: total > 0 ? Math.round((onTarget / total) * 100) : 100,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────

/** Tokenize text into lowercase words, filtering stop words and short tokens */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** FNV-1a hash for deterministic token mapping */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0;
  }
  return hash;
}

/** L2 normalize a vector */
export function l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "could", "should", "may", "might", "can",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very",
  "just", "about", "above", "after", "again", "all", "also", "any",
  "because", "before", "between", "both", "each", "few", "get",
  "got", "here", "how", "into", "its", "more", "most", "much",
  "must", "new", "now", "only", "other", "our", "out", "over",
  "own", "same", "she", "some", "such", "them", "there", "these",
  "they", "those", "through", "under", "until", "what", "when",
  "where", "which", "while", "who", "whom", "why", "you", "your",
]);
