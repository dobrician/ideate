import { getVelocitySummary } from "@/lib/analytics/velocity";
import { buildSocialNetwork } from "@/lib/analytics/social";
import { getMomentumSnapshot } from "@/lib/analytics/momentum";
import { getPredictionSummary } from "@/lib/analytics/predictions";

export async function getAdvancedAnalyticsData() {
  const [velocity, social, momentum, predictions] = await Promise.all([
    getVelocitySummary(30, 10),
    buildSocialNetwork(30, 50),
    getMomentumSnapshot(10),
    getPredictionSummary(10),
  ]);

  return { velocity, social, momentum, predictions };
}
