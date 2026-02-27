"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";
import { Timer, TrendingUp, TrendingDown, Minus, BarChart3, Zap } from "lucide-react";
import type { CiBuildEntry } from "@/lib/ci-builds";

interface CiBuildStats {
  count: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  latestDurationMs: number | null;
  trend: "improving" | "stable" | "regressing" | "insufficient";
}

interface Props {
  builds: CiBuildEntry[];
  stats: CiBuildStats;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function TrendBadge({ trend }: { trend: CiBuildStats["trend"] }) {
  const { t } = useLocale();
  switch (trend) {
    case "improving":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <TrendingDown className="h-3 w-3" />
          {t("ciBuild.trendImproving")}
        </span>
      );
    case "regressing":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <TrendingUp className="h-3 w-3" />
          {t("ciBuild.trendRegressing")}
        </span>
      );
    case "stable":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Minus className="h-3 w-3" />
          {t("ciBuild.trendStable")}
        </span>
      );
    default:
      return (
        <span className="text-xs text-muted-foreground">{t("ciBuild.trendInsufficient")}</span>
      );
  }
}

export function CiBuildTrendsPanel({ builds, stats }: Props) {
  const { t } = useLocale();

  // Simple bar chart: max 20 most recent builds, reversed for chronological order
  const chartBuilds = builds.slice(0, 20).reverse();
  const maxDuration = chartBuilds.length > 0 ? Math.max(...chartBuilds.map((b) => b.durationMs)) : 1;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        {t("ciBuild.title")}
      </h2>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("ciBuild.latest")}</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.latestDurationMs !== null ? formatDuration(stats.latestDurationMs) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("ciBuild.average")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats.avgDurationMs)}</div>
            <p className="text-xs text-muted-foreground">
              {t("ciBuild.minMax")}: {formatDuration(stats.minDurationMs)} – {formatDuration(stats.maxDurationMs)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("ciBuild.totalBuilds")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("ciBuild.trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBadge trend={stats.trend} />
          </CardContent>
        </Card>
      </div>

      {/* Duration Chart (simple CSS bar chart) */}
      {chartBuilds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("ciBuild.durationChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32" role="img" aria-label={t("ciBuild.durationChart")}>
              {chartBuilds.map((build) => {
                const heightPercent = (build.durationMs / maxDuration) * 100;
                const isFailure = build.status === "failure";
                return (
                  <div
                    key={build.id}
                    className="flex-1 min-w-0 group relative"
                    title={`${build.commitHash.slice(0, 7)} — ${formatDuration(build.durationMs)}`}
                  >
                    <div
                      className={`w-full rounded-t transition-colors ${
                        isFailure
                          ? "bg-red-400 dark:bg-red-600"
                          : "bg-primary/60 group-hover:bg-primary"
                      }`}
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>{chartBuilds[0]?.commitHash?.slice(0, 7)}</span>
              <span>{chartBuilds[chartBuilds.length - 1]?.commitHash?.slice(0, 7)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Builds Table */}
      {builds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("ciBuild.recentBuilds")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y max-h-64 overflow-y-auto">
              {builds.slice(0, 15).map((build) => (
                <div key={build.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-xs font-mono text-muted-foreground">{build.commitHash.slice(0, 7)}</code>
                    <span className={`inline-block h-2 w-2 rounded-full ${build.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="truncate text-muted-foreground">{build.branch}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {build.buildSizeBytes && (
                      <span className="text-xs text-muted-foreground">
                        {(build.buildSizeBytes / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    )}
                    <span className="font-medium">{formatDuration(build.durationMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {builds.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("ciBuild.noData")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
