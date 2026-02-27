import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ShieldX,
  Database,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Brain,
} from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getEmbeddingStats } from "@/lib/embeddings";

export default async function EmbeddingsPage() {
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

  const stats = await getEmbeddingStats();

  const coveragePercent = (type: string) => {
    const covered = stats.byType[type] ?? 0;
    const total = stats.entityTotals[type] ?? 0;
    if (total === 0) return 0;
    return Math.round((covered / total) * 100);
  };

  const coverageLabel = (type: string) => {
    const covered = stats.byType[type] ?? 0;
    const total = stats.entityTotals[type] ?? 0;
    const percent = coveragePercent(type);
    return t("admin.embeddingCoveragePercent")
      .replace("{covered}", String(covered))
      .replace("{total}", String(total))
      .replace("{percent}", String(percent));
  };

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("aiInsights.backToAdmin")}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.embeddings")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.embeddingsDesc")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Database className="h-4 w-4" />
            {t("admin.embeddingTotal")}
          </div>
          <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Cpu className="h-4 w-4" />
            {t("admin.embeddingModel")}
          </div>
          <div className="text-lg font-bold truncate">{stats.activeModel}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            {stats.apiAvailable ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            {t("admin.embeddingApiStatus")}
          </div>
          <div className={`text-sm font-medium ${stats.apiAvailable ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
            {stats.apiAvailable ? t("admin.embeddingApiAvailable") : t("admin.embeddingApiUnavailable")}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Layers className="h-4 w-4" />
            {t("admin.embeddingCoverage")}
          </div>
          <div className="text-2xl font-bold">
            {stats.entityTotals.project + stats.entityTotals.proposal > 0
              ? Math.round(
                  (stats.total / (stats.entityTotals.project + stats.entityTotals.proposal)) * 100
                )
              : 0}
            %
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Coverage by Entity Type */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t("admin.embeddingByType")}
            </h2>
          </div>
          <div className="divide-y">
            {(["project", "proposal"] as const).map((type) => {
              const covered = stats.byType[type] ?? 0;
              const total = stats.entityTotals[type] ?? 0;
              const pct = coveragePercent(type);
              return (
                <div key={type} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium capitalize">
                      {type === "project" ? t("admin.embeddingProjects") : t("admin.embeddingProposals")}
                    </div>
                    <div className="text-sm text-muted-foreground">{coverageLabel(type)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
            {(stats.byType.comment ?? 0) > 0 && (
              <div className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{t("admin.embeddingComments")}</div>
                  <div className="text-sm text-muted-foreground">{stats.byType.comment} embedded</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Model Distribution */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t("admin.embeddingByModel")}
            </h2>
          </div>
          <div className="divide-y">
            {Object.entries(stats.byModel).length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">{t("admin.noData")}</div>
            ) : (
              Object.entries(stats.byModel)
                .sort(([, a], [, b]) => b - a)
                .map(([model, modelCount]) => (
                  <div key={model} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium font-mono text-sm">{model}</div>
                      <div className="text-xs text-muted-foreground">
                        {model === "tfidf"
                          ? t("admin.embeddingLocalDesc")
                          : t("admin.embeddingOpenaiDesc").replace("{model}", model)}
                      </div>
                    </div>
                    <span className="text-sm font-bold">{modelCount}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Model Information */}
      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4" />
          {t("admin.embeddingModelInfo")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${!stats.apiAvailable ? "bg-green-500" : "bg-muted-foreground/50"}`} />
              <span className="text-sm font-medium">TF-IDF (Local)</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.embeddingLocalDesc")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-2 w-2 rounded-full ${stats.apiAvailable ? "bg-green-500" : "bg-muted-foreground/50"}`} />
              <span className="text-sm font-medium">OpenAI</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("admin.embeddingOpenaiDesc").replace("{model}", stats.activeModel)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
