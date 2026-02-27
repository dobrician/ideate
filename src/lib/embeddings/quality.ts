/**
 * Embedding quality scoring — measures embedding similarity accuracy
 * and tracks quality metrics over time.
 *
 * Quality is measured by sampling embeddings and computing:
 * 1. Self-consistency: same-type embeddings that share content should be similar
 * 2. Cross-type separation: different entity types should have lower similarity
 * 3. Model coherence: embeddings from the same model should cluster tightly
 */
import { db } from "@/db";
import { embeddings } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { cosineSimilarity } from "@/lib/embeddings";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "embedding-quality" });

export interface EmbeddingQualityScore {
  overallScore: number; // 0-100
  selfSimilarity: number; // avg cosine similarity within same type
  crossSimilarity: number; // avg cosine similarity across types
  separation: number; // difference between self and cross (higher is better)
  sampleSize: number;
  grade: "good" | "fair" | "poor";
  byModel: Record<string, { avgSimilarity: number; count: number }>;
}

/**
 * Compute embedding quality score by sampling and comparing embeddings.
 * Samples up to `sampleLimit` embeddings per entity type.
 */
export async function getEmbeddingQualityScore(
  sampleLimit = 20
): Promise<EmbeddingQualityScore> {
  try {
    // Sample embeddings by type
    const types = ["project", "proposal"] as const;
    const samples: Record<string, Array<{ entityId: string; vector: number[]; model: string }>> = {};

    for (const type of types) {
      const rows = await db
        .select({
          entityId: embeddings.entityId,
          vector: embeddings.vector,
          model: embeddings.model,
        })
        .from(embeddings)
        .where(eq(embeddings.entityType, type))
        .orderBy(desc(embeddings.updatedAt))
        .limit(sampleLimit);

      samples[type] = rows
        .map((r) => {
          try {
            return { entityId: r.entityId, vector: JSON.parse(r.vector) as number[], model: r.model };
          } catch {
            return null;
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
    }

    const allSamples = Object.values(samples).flat();
    if (allSamples.length < 2) {
      return {
        overallScore: 0,
        selfSimilarity: 0,
        crossSimilarity: 0,
        separation: 0,
        sampleSize: allSamples.length,
        grade: "poor",
        byModel: {},
      };
    }

    // Compute self-similarity (within same type)
    let selfSimSum = 0;
    let selfSimCount = 0;
    for (const type of types) {
      const s = samples[type] ?? [];
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          if (s[i].vector.length === s[j].vector.length) {
            selfSimSum += cosineSimilarity(s[i].vector, s[j].vector);
            selfSimCount++;
          }
        }
      }
    }

    // Compute cross-similarity (across types)
    let crossSimSum = 0;
    let crossSimCount = 0;
    const projectSamples = samples.project ?? [];
    const proposalSamples = samples.proposal ?? [];
    for (const p of projectSamples) {
      for (const q of proposalSamples) {
        if (p.vector.length === q.vector.length) {
          crossSimSum += cosineSimilarity(p.vector, q.vector);
          crossSimCount++;
        }
      }
    }

    const selfSimilarity = selfSimCount > 0 ? selfSimSum / selfSimCount : 0;
    const crossSimilarity = crossSimCount > 0 ? crossSimSum / crossSimCount : 0;
    const separation = selfSimilarity - crossSimilarity;

    // Model-level stats
    const byModel: Record<string, { simSum: number; simCount: number; count: number }> = {};
    for (const sample of allSamples) {
      if (!byModel[sample.model]) {
        byModel[sample.model] = { simSum: 0, simCount: 0, count: 0 };
      }
      byModel[sample.model].count++;
    }

    // Compute intra-model similarity
    const modelGroups = new Map<string, typeof allSamples>();
    for (const sample of allSamples) {
      if (!modelGroups.has(sample.model)) modelGroups.set(sample.model, []);
      modelGroups.get(sample.model)!.push(sample);
    }
    for (const [model, group] of modelGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (group[i].vector.length === group[j].vector.length) {
            byModel[model].simSum += cosineSimilarity(group[i].vector, group[j].vector);
            byModel[model].simCount++;
          }
        }
      }
    }

    const byModelResult: Record<string, { avgSimilarity: number; count: number }> = {};
    for (const [model, data] of Object.entries(byModel)) {
      byModelResult[model] = {
        avgSimilarity: data.simCount > 0 ? Math.round((data.simSum / data.simCount) * 1000) / 1000 : 0,
        count: data.count,
      };
    }

    // Overall score: weighted combination
    // Higher self-similarity + lower cross-similarity + good separation = better
    const selfScore = Math.max(0, Math.min(1, selfSimilarity)) * 40;
    const separationScore = Math.max(0, Math.min(1, separation + 0.5)) * 40; // shift so 0 separation → 50%
    const coverageScore = Math.min(1, allSamples.length / 10) * 20; // bonus for having enough samples
    const overallScore = Math.round(selfScore + separationScore + coverageScore);

    const grade =
      overallScore >= 65 ? "good" : overallScore >= 35 ? "fair" : "poor";

    log.info(
      { overallScore, selfSimilarity: selfSimilarity.toFixed(3), crossSimilarity: crossSimilarity.toFixed(3), sampleSize: allSamples.length },
      "Embedding quality scored"
    );

    return {
      overallScore,
      selfSimilarity: Math.round(selfSimilarity * 1000) / 1000,
      crossSimilarity: Math.round(crossSimilarity * 1000) / 1000,
      separation: Math.round(separation * 1000) / 1000,
      sampleSize: allSamples.length,
      grade,
      byModel: byModelResult,
    };
  } catch (err) {
    log.warn({ err }, "Failed to compute embedding quality score");
    return {
      overallScore: 0,
      selfSimilarity: 0,
      crossSimilarity: 0,
      separation: 0,
      sampleSize: 0,
      grade: "poor",
      byModel: {},
    };
  }
}

/**
 * Get embedding dimension consistency — checks if all embeddings
 * for a given model have the same dimensions.
 */
export async function getEmbeddingDimensionStats(): Promise<
  Array<{ model: string; dimensions: number; count: number }>
> {
  try {
    const rows = await db
      .select({
        model: embeddings.model,
        dimensions: embeddings.dimensions,
        count: sql<number>`COUNT(*)`.as("count"),
      })
      .from(embeddings)
      .groupBy(embeddings.model, embeddings.dimensions);

    return rows.map((r) => ({
      model: r.model,
      dimensions: r.dimensions ?? 0,
      count: r.count,
    }));
  } catch {
    return [];
  }
}
