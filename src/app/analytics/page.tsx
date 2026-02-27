import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ShieldX, TrendingUp, Zap, Network, Target,
  Users, Activity, BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { getAdvancedAnalyticsData } from "./queries";
import { VelocityChart, MomentumChart, InfluenceChart, PredictionChart } from "./charts";

export default async function AdvancedAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { t } = await getTranslations();

  if (!hasPermission(user.role as Role, "user:manage")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <ShieldX className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("common.accessDenied")}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("common.accessDeniedDesc")}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">{t("common.goToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  const data = await getAdvancedAnalyticsData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("advancedAnalytics.backToAdmin")}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("advancedAnalytics.title")}</h1>
          <p className="text-muted-foreground">{t("advancedAnalytics.subtitle")}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title={t("advancedAnalytics.velocity")}
          value={data.velocity.fastestGrowing.length}
          icon={<Zap className="h-4 w-4 text-muted-foreground" />}
          description={t("advancedAnalytics.velocityDesc")}
        />
        <StatCard
          title={t("advancedAnalytics.activeUsers")}
          value={data.social.stats.activeUsers}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          description={t("advancedAnalytics.avgConnections") + ": " + data.social.stats.averageConnections}
        />
        <StatCard
          title={t("advancedAnalytics.avgMomentum")}
          value={data.momentum.averageMomentum}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          description={data.momentum.proposals.length + " " + t("analytics.proposals").toLowerCase()}
        />
        <StatCard
          title={t("advancedAnalytics.avgConfidence")}
          value={data.predictions.averageAccuracy}
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          description={data.predictions.predictions.length + " " + t("advancedAnalytics.predictions").toLowerCase()}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <VelocityChart
          data={data.velocity.fastestGrowing}
          title={t("advancedAnalytics.fastestGrowing")}
        />
        <MomentumChart
          data={data.momentum.proposals}
          title={t("advancedAnalytics.topMomentum")}
        />
        <InfluenceChart
          data={data.social.influencers}
          title={t("advancedAnalytics.topInfluencers")}
        />
        <PredictionChart
          data={data.predictions.predictions}
          title={t("advancedAnalytics.topPredictions")}
        />
      </div>

      {/* Detail tables */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Velocity Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-4 w-4" />
              {t("advancedAnalytics.velocity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.velocity.fastestGrowing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("advancedAnalytics.noData")}</p>
            ) : (
              <div className="space-y-2">
                {data.velocity.fastestGrowing.map((v) => (
                  <div key={v.proposalId} className="flex items-center justify-between rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{v.proposalTitle}</p>
                      <p className="text-xs text-muted-foreground">{v.projectTitle}</p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="font-mono text-xs">{v.currentRate} {t("advancedAnalytics.votesPerDay")}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">+{v.acceleration} {t("advancedAnalytics.acceleration")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-4 w-4" />
              {t("advancedAnalytics.social")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold">{data.social.stats.activeUsers}</p>
                <p className="text-xs text-muted-foreground">{t("advancedAnalytics.activeUsers")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.social.stats.averageConnections}</p>
                <p className="text-xs text-muted-foreground">{t("advancedAnalytics.avgConnections")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(data.social.stats.density * 100)}%</p>
                <p className="text-xs text-muted-foreground">{t("advancedAnalytics.networkDensity")}</p>
              </div>
            </div>
            {data.social.influencers.length > 0 && (
              <div className="space-y-2">
                {data.social.influencers.slice(0, 5).map((u) => (
                  <div key={u.userId} className="flex items-center justify-between text-sm">
                    <span className="truncate">{u.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {t("advancedAnalytics.influence")}: {u.influence}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
