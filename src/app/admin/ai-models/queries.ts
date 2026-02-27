import { db } from "@/db";
import { aiModels, aiFeedback } from "@/db/schema";
import { desc, sql, eq } from "drizzle-orm";

export async function getAiModelsData() {
  const [models, feedbackStats] = await Promise.all([
    db.select().from(aiModels).orderBy(desc(aiModels.createdAt)),
    db
      .select({
        feature: aiFeedback.feature,
        total: sql<number>`COUNT(*)`,
        avgRating: sql<number>`ROUND(AVG(rating), 1)`,
        positive: sql<number>`SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)`,
      })
      .from(aiFeedback)
      .groupBy(aiFeedback.feature),
  ]);

  const feedbackMap = new Map(
    feedbackStats.map(f => [f.feature, {
      total: Number(f.total),
      avgRating: Number(f.avgRating),
      positiveRate: Number(f.total) > 0
        ? Math.round((Number(f.positive) / Number(f.total)) * 100)
        : 0,
    }])
  );

  return { models, feedbackMap: Object.fromEntries(feedbackMap) };
}
