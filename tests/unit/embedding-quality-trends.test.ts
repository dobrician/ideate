import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  return { db: mockDb };
});
vi.mock("@/db/schema", () => ({
  embeddingQualitySnapshots: { createdAt: "created_at" },
}));
vi.mock("@/lib/embeddings/quality", () => ({
  getEmbeddingQualityScore: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { db } from "@/db";
import { getEmbeddingQualityScore } from "@/lib/embeddings/quality";
import {
  takeQualitySnapshot,
  getQualityTrend,
  getQualityTrendSummary,
} from "@/lib/embeddings/quality-trends";

describe("embedding-quality-trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("takeQualitySnapshot", () => {
    it("takes a snapshot when embeddings exist", async () => {
      vi.mocked(getEmbeddingQualityScore).mockResolvedValue({
        overallScore: 72,
        selfSimilarity: 0.85,
        crossSimilarity: 0.3,
        separation: 0.55,
        sampleSize: 20,
        grade: "good",
        byModel: { tfidf: { avgSimilarity: 0.82, count: 15 } },
      });

      const mockRow = {
        id: "snap-1",
        overallScore: 72,
        selfSimilarity: 8500,
        crossSimilarity: 3000,
        separation: 5500,
        sampleSize: 20,
        grade: "good",
        byModel: '{"tfidf":{"avgSimilarity":0.82,"count":15}}',
        createdAt: new Date("2026-03-05"),
      };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRow]),
        }),
      } as never);

      const snapshot = await takeQualitySnapshot();

      expect(snapshot).not.toBeNull();
      expect(snapshot!.overallScore).toBe(72);
      expect(snapshot!.selfSimilarity).toBe(0.85);
      expect(snapshot!.grade).toBe("good");
      expect(snapshot!.byModel).toEqual({ tfidf: { avgSimilarity: 0.82, count: 15 } });
    });

    it("returns null when no embeddings to score", async () => {
      vi.mocked(getEmbeddingQualityScore).mockResolvedValue({
        overallScore: 0,
        selfSimilarity: 0,
        crossSimilarity: 0,
        separation: 0,
        sampleSize: 0,
        grade: "poor",
        byModel: {},
      });

      const snapshot = await takeQualitySnapshot();
      expect(snapshot).toBeNull();
    });

    it("returns null on error", async () => {
      vi.mocked(getEmbeddingQualityScore).mockRejectedValue(new Error("DB error"));

      const snapshot = await takeQualitySnapshot();
      expect(snapshot).toBeNull();
    });
  });

  describe("getQualityTrend", () => {
    it("returns deserialized snapshots", async () => {
      const mockRows = [
        {
          id: "s1",
          overallScore: 70,
          selfSimilarity: 8000,
          crossSimilarity: 2500,
          separation: 5500,
          sampleSize: 15,
          grade: "good",
          byModel: "{}",
          createdAt: new Date("2026-03-05"),
        },
        {
          id: "s2",
          overallScore: 65,
          selfSimilarity: 7500,
          crossSimilarity: 3000,
          separation: 4500,
          sampleSize: 12,
          grade: "good",
          byModel: null,
          createdAt: new Date("2026-03-04"),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        }),
      } as never);

      const trend = await getQualityTrend(30, 10);

      expect(trend).toHaveLength(2);
      expect(trend[0].selfSimilarity).toBe(0.8);
      expect(trend[1].crossSimilarity).toBe(0.3);
    });

    it("returns empty array on error", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("fail")),
            }),
          }),
        }),
      } as never);

      const trend = await getQualityTrend();
      expect(trend).toEqual([]);
    });
  });

  describe("getQualityTrendSummary", () => {
    it("returns insufficient when no snapshots", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const summary = await getQualityTrendSummary();

      expect(summary.trend).toBe("insufficient");
      expect(summary.latest).toBeNull();
      expect(summary.snapshotCount).toBe(0);
    });

    it("detects improving trend", async () => {
      const snapshots = [
        // Recent (higher scores)
        { id: "s1", overallScore: 80, selfSimilarity: 8000, crossSimilarity: 2000, separation: 6000, sampleSize: 20, grade: "good", byModel: "{}", createdAt: new Date("2026-03-05") },
        { id: "s2", overallScore: 78, selfSimilarity: 7800, crossSimilarity: 2200, separation: 5600, sampleSize: 20, grade: "good", byModel: "{}", createdAt: new Date("2026-03-04") },
        // Older (lower scores)
        { id: "s3", overallScore: 60, selfSimilarity: 6000, crossSimilarity: 3000, separation: 3000, sampleSize: 15, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-03") },
        { id: "s4", overallScore: 58, selfSimilarity: 5800, crossSimilarity: 3200, separation: 2600, sampleSize: 15, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-02") },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(snapshots),
            }),
          }),
        }),
      } as never);

      const summary = await getQualityTrendSummary();

      expect(summary.trend).toBe("improving");
      expect(summary.snapshotCount).toBe(4);
      expect(summary.latest!.overallScore).toBe(80);
    });

    it("detects declining trend", async () => {
      const snapshots = [
        { id: "s1", overallScore: 40, selfSimilarity: 4000, crossSimilarity: 3000, separation: 1000, sampleSize: 10, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-05") },
        { id: "s2", overallScore: 42, selfSimilarity: 4200, crossSimilarity: 2800, separation: 1400, sampleSize: 10, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-04") },
        { id: "s3", overallScore: 70, selfSimilarity: 7000, crossSimilarity: 2000, separation: 5000, sampleSize: 18, grade: "good", byModel: "{}", createdAt: new Date("2026-03-03") },
        { id: "s4", overallScore: 72, selfSimilarity: 7200, crossSimilarity: 1800, separation: 5400, sampleSize: 18, grade: "good", byModel: "{}", createdAt: new Date("2026-03-02") },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(snapshots),
            }),
          }),
        }),
      } as never);

      const summary = await getQualityTrendSummary();

      expect(summary.trend).toBe("declining");
    });

    it("detects stable trend", async () => {
      const snapshots = [
        { id: "s1", overallScore: 65, selfSimilarity: 6500, crossSimilarity: 2500, separation: 4000, sampleSize: 15, grade: "good", byModel: "{}", createdAt: new Date("2026-03-05") },
        { id: "s2", overallScore: 66, selfSimilarity: 6600, crossSimilarity: 2400, separation: 4200, sampleSize: 15, grade: "good", byModel: "{}", createdAt: new Date("2026-03-04") },
        { id: "s3", overallScore: 64, selfSimilarity: 6400, crossSimilarity: 2600, separation: 3800, sampleSize: 15, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-03") },
        { id: "s4", overallScore: 63, selfSimilarity: 6300, crossSimilarity: 2700, separation: 3600, sampleSize: 15, grade: "fair", byModel: "{}", createdAt: new Date("2026-03-02") },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(snapshots),
            }),
          }),
        }),
      } as never);

      const summary = await getQualityTrendSummary();

      expect(summary.trend).toBe("stable");
    });
  });
});
