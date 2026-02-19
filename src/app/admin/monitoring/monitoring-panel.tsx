"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Database, Layers, Clock, Zap } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import type { PerfStats } from "@/lib/perf-monitor";

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memEntries: number;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
}

export function MonitoringPanel({
  perfStats,
  cacheStats,
  queueStats,
}: {
  perfStats: PerfStats;
  cacheStats: CacheStats;
  queueStats: QueueStats;
}) {
  const { t } = useLocale();

  return (
    <div className="grid gap-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("monitoring.totalRequests")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{perfStats.totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("monitoring.avgResponse")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{perfStats.avgResponseMs}ms</p>
            <p className="text-xs text-muted-foreground">p95: {perfStats.p95ResponseMs}ms</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("monitoring.cacheHitRate")}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cacheStats.hitRate}%</p>
            <p className="text-xs text-muted-foreground">
              {cacheStats.hits} {t("monitoring.hits")} / {cacheStats.misses} {t("monitoring.misses")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("monitoring.queuePending")}</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{queueStats.pending}</p>
            <p className="text-xs text-muted-foreground">
              {queueStats.completed} {t("monitoring.completed")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Queue Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t("monitoring.queueStats")}
          </CardTitle>
          <CardDescription>{t("monitoring.queueDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 text-center">
            {(["pending", "processing", "completed", "failed", "dead"] as const).map((s) => (
              <div key={s} className="rounded-lg border p-3">
                <p className="text-2xl font-bold">{queueStats[s]}</p>
                <p className="text-xs capitalize text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cache Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("monitoring.cacheStats")}
          </CardTitle>
          <CardDescription>
            {t("monitoring.memEntries", { count: cacheStats.memEntries })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-green-600">{cacheStats.hits}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.hits")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-red-600">{cacheStats.misses}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.misses")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{cacheStats.hitRate}%</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.hitRate")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slowest Paths */}
      {perfStats.slowestPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("monitoring.slowestPaths")}</CardTitle>
            <CardDescription>{t("monitoring.slowestDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">{t("monitoring.path")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("monitoring.avgMs")}</th>
                  <th className="pb-2 font-medium">{t("monitoring.requests")}</th>
                </tr>
              </thead>
              <tbody>
                {perfStats.slowestPaths.map((p) => (
                  <tr key={p.path} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{p.path}</td>
                    <td className="py-2 pr-4">{p.avgMs}ms</td>
                    <td className="py-2">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Recent Requests */}
      {perfStats.recentTimings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("monitoring.recentRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">{t("monitoring.method")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("monitoring.path")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("monitoring.status")}</th>
                  <th className="pb-2 font-medium">{t("monitoring.duration")}</th>
                </tr>
              </thead>
              <tbody>
                {perfStats.recentTimings.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{t.method}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs">{t.path}</td>
                    <td className="py-1.5 pr-4">{t.status}</td>
                    <td className="py-1.5">{t.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
