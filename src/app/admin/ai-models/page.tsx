import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ShieldX, Brain, Star, TrendingUp, Layers,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { getTranslations } from "@/lib/i18n-server";
import { getAiModelsData } from "./queries";

export default async function AiModelsPage() {
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

  const { models, feedbackMap } = await getAiModelsData();

  const activeModels = models.filter(m => m.status === "active").length;
  const totalPredictions = models.reduce((s, m) => s + m.totalPredictions, 0);
  const avgAccuracy = models.length > 0
    ? Math.round(models.reduce((s, m) => s + (m.accuracy ?? 0), 0) / models.length)
    : 0;
  const features = new Set(models.map(m => m.feature)).size;

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin"><ArrowLeft className="mr-1 h-4 w-4" />{t("aiModels.backToAdmin")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("aiModels.title")}</h1>
          <p className="text-muted-foreground">{t("aiModels.subtitle")}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title={t("aiModels.activeModels")}
          value={activeModels}
          icon={<Brain className="h-4 w-4 text-muted-foreground" />}
          description={`${models.length} total`}
        />
        <StatCard
          title={t("aiModels.totalPredictions")}
          value={totalPredictions}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          description={`${avgAccuracy}% avg accuracy`}
        />
        <StatCard
          title={t("aiModels.features")}
          value={features}
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
          description="AI feature areas"
        />
        <StatCard
          title={t("aiModels.feedbackCollected")}
          value={Object.values(feedbackMap).reduce((s: number, f: { total: number }) => s + f.total, 0)}
          icon={<Star className="h-4 w-4 text-muted-foreground" />}
          description="User ratings"
        />
      </div>

      {/* Models Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("aiModels.registeredModels")}</CardTitle>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <p className="text-muted-foreground">{t("aiModels.noModels")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">{t("aiModels.name")}</th>
                    <th className="pb-2 font-medium">{t("aiModels.feature")}</th>
                    <th className="pb-2 font-medium">{t("aiModels.version")}</th>
                    <th className="pb-2 font-medium">{t("aiModels.provider")}</th>
                    <th className="pb-2 font-medium">{t("aiModels.accuracy")}</th>
                    <th className="pb-2 font-medium">{t("aiModels.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(model => (
                    <tr key={model.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{model.name}</td>
                      <td className="py-2 capitalize">{model.feature}</td>
                      <td className="py-2 font-mono text-xs">{model.version}</td>
                      <td className="py-2 capitalize">{model.provider}</td>
                      <td className="py-2 font-mono">
                        {model.accuracy != null ? `${model.accuracy}%` : "—"}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({model.correctPredictions}/{model.totalPredictions})
                        </span>
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={model.status === "active" ? "default" : model.status === "testing" ? "secondary" : "outline"}
                          className={model.status === "active" ? "bg-green-600 dark:bg-green-700" : ""}
                        >
                          {model.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback by Feature */}
      <Card>
        <CardHeader>
          <CardTitle>{t("aiModels.feedbackByFeature")}</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(feedbackMap).length === 0 ? (
            <p className="text-muted-foreground">{t("aiModels.noFeedback")}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(feedbackMap).map(([feature, stats]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="capitalize">{feature}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono">{(stats as { avgRating: number }).avgRating}/5</span>
                    <Badge variant="secondary">
                      {(stats as { positiveRate: number }).positiveRate}% positive
                    </Badge>
                    <span className="text-muted-foreground">
                      {(stats as { total: number }).total} ratings
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
