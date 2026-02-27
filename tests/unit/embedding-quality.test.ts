import { describe, it, expect, vi, beforeEach } from "vitest";

// Track query calls
let queryResults: unknown[][] = [];
let queryIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(queryResults[queryIndex++] ?? []),
          }),
          groupBy: () => Promise.resolve(queryResults[queryIndex++] ?? []),
          limit: () => Promise.resolve(queryResults[queryIndex++] ?? []),
        }),
        groupBy: () => Promise.resolve(queryResults[queryIndex++] ?? []),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  embeddings: {
    entityType: "entityType",
    entityId: "entityId",
    vector: "vector",
    model: "model",
    dimensions: "dimensions",
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock("@/lib/embeddings", () => ({
  cosineSimilarity: (a: number[], b: number[]) => {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    const mag = Math.sqrt(nA) * Math.sqrt(nB);
    return mag === 0 ? 0 : dot / mag;
  },
}));

import { getEmbeddingQualityScore, getEmbeddingDimensionStats } from "@/lib/embeddings/quality";

describe("embedding-quality", () => {
  beforeEach(() => {
    queryResults = [];
    queryIndex = 0;
  });

  describe("getEmbeddingQualityScore", () => {
    it("returns zero score when no embeddings exist", async () => {
      queryResults = [[], []]; // empty for both types
      const score = await getEmbeddingQualityScore();

      expect(score.overallScore).toBe(0);
      expect(score.sampleSize).toBe(0);
      expect(score.grade).toBe("poor");
      expect(score.selfSimilarity).toBe(0);
      expect(score.crossSimilarity).toBe(0);
    });

    it("returns zero score with only 1 embedding", async () => {
      queryResults = [
        [{ entityId: "p1", vector: JSON.stringify([1, 0, 0]), model: "tfidf" }],
        [], // proposals empty
      ];

      const score = await getEmbeddingQualityScore();
      expect(score.sampleSize).toBe(1);
      expect(score.overallScore).toBe(0);
      expect(score.grade).toBe("poor");
    });

    it("computes quality for multiple embeddings within same type", async () => {
      queryResults = [
        // Projects: similar vectors
        [
          { entityId: "p1", vector: JSON.stringify([1, 0, 0]), model: "tfidf" },
          { entityId: "p2", vector: JSON.stringify([0.9, 0.1, 0]), model: "tfidf" },
          { entityId: "p3", vector: JSON.stringify([0.8, 0.2, 0]), model: "tfidf" },
        ],
        // Proposals: different direction
        [
          { entityId: "q1", vector: JSON.stringify([0, 1, 0]), model: "tfidf" },
          { entityId: "q2", vector: JSON.stringify([0, 0.9, 0.1]), model: "tfidf" },
          { entityId: "q3", vector: JSON.stringify([0, 0.8, 0.2]), model: "tfidf" },
        ],
      ];

      const score = await getEmbeddingQualityScore();

      expect(score.sampleSize).toBe(6);
      expect(score.selfSimilarity).toBeGreaterThan(0);
      expect(score.crossSimilarity).toBeDefined();
      expect(score.separation).toBeDefined();
      expect(score.overallScore).toBeGreaterThan(0);
      expect(["good", "fair", "poor"]).toContain(score.grade);
      expect(score.byModel.tfidf).toBeDefined();
      expect(score.byModel.tfidf.count).toBe(6);
    });

    it("handles separation between types", async () => {
      // Well-separated clusters should score higher
      queryResults = [
        [
          { entityId: "p1", vector: JSON.stringify([1, 0, 0, 0]), model: "tfidf" },
          { entityId: "p2", vector: JSON.stringify([1, 0.01, 0, 0]), model: "tfidf" },
        ],
        [
          { entityId: "q1", vector: JSON.stringify([0, 0, 1, 0]), model: "tfidf" },
          { entityId: "q2", vector: JSON.stringify([0, 0, 1, 0.01]), model: "tfidf" },
        ],
      ];

      const score = await getEmbeddingQualityScore();

      expect(score.selfSimilarity).toBeGreaterThan(score.crossSimilarity);
      expect(score.separation).toBeGreaterThan(0);
    });

    it("handles malformed vector JSON gracefully", async () => {
      queryResults = [
        [
          { entityId: "p1", vector: "not json", model: "tfidf" },
          { entityId: "p2", vector: JSON.stringify([1, 0, 0]), model: "tfidf" },
        ],
        [],
      ];

      const score = await getEmbeddingQualityScore();
      // Should not throw; malformed entries are filtered out
      expect(score.sampleSize).toBe(1);
    });

    it("handles different vector dimensions", async () => {
      queryResults = [
        [
          { entityId: "p1", vector: JSON.stringify([1, 0, 0]), model: "tfidf" },
          { entityId: "p2", vector: JSON.stringify([0.9, 0.1, 0, 0.5]), model: "openai" },
        ],
        [],
      ];

      const score = await getEmbeddingQualityScore();
      // Different dimensions should be skipped in similarity calc
      expect(score.sampleSize).toBe(2);
    });

    it("reports per-model statistics", async () => {
      queryResults = [
        [
          { entityId: "p1", vector: JSON.stringify([1, 0, 0]), model: "tfidf" },
          { entityId: "p2", vector: JSON.stringify([0.9, 0.1, 0]), model: "tfidf" },
        ],
        [
          { entityId: "q1", vector: JSON.stringify([0, 1, 0]), model: "openai" },
          { entityId: "q2", vector: JSON.stringify([0, 0.9, 0.1]), model: "openai" },
        ],
      ];

      const score = await getEmbeddingQualityScore();

      expect(Object.keys(score.byModel)).toContain("tfidf");
      expect(Object.keys(score.byModel)).toContain("openai");
      expect(score.byModel.tfidf.count).toBe(2);
      expect(score.byModel.openai.count).toBe(2);
    });

    it("assigns good grade for high-quality embeddings", async () => {
      // Tight clusters, well-separated, good sample size
      const makeVec = (base: number[], noise: number) =>
        JSON.stringify(base.map((v) => v + (Math.random() - 0.5) * noise));

      queryResults = [
        Array.from({ length: 10 }, (_, i) => ({
          entityId: `p${i}`,
          vector: makeVec([1, 0, 0, 0, 0], 0.01),
          model: "tfidf",
        })),
        Array.from({ length: 10 }, (_, i) => ({
          entityId: `q${i}`,
          vector: makeVec([0, 0, 0, 0, 1], 0.01),
          model: "tfidf",
        })),
      ];

      const score = await getEmbeddingQualityScore();

      expect(score.overallScore).toBeGreaterThan(50);
      expect(score.grade).not.toBe("poor");
    });
  });

  describe("getEmbeddingDimensionStats", () => {
    it("returns empty array when no embeddings", async () => {
      queryResults = [[]];
      const stats = await getEmbeddingDimensionStats();
      expect(stats).toEqual([]);
    });

    it("returns dimension breakdown", async () => {
      queryResults = [
        [
          { model: "tfidf", dimensions: 256, count: 10 },
          { model: "text-embedding-3-small", dimensions: 1536, count: 5 },
        ],
      ];

      const stats = await getEmbeddingDimensionStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({ model: "tfidf", dimensions: 256, count: 10 });
      expect(stats[1]).toEqual({ model: "text-embedding-3-small", dimensions: 1536, count: 5 });
    });
  });
});
