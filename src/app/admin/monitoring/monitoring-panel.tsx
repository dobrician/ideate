"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Database, Layers, Clock, Zap, HardDrive, Server, Radio } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import type { PerfStats } from "@/lib/perf-monitor";
import type { ResourceStats } from "@/lib/resource-monitor";

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memEntries: number;
  redisHits: number;
  redisMisses: number;
  redisEnabled: boolean;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface WsStats {
  total: number;
  authenticated: number;
  channels: Record<string, number>;
}

export function MonitoringPanel({
  perfStats,
  cacheStats,
  queueStats,
  resourceStats,
  wsStats,
}: {
  perfStats: PerfStats;
  cacheStats: CacheStats;
  queueStats: QueueStats;
  resourceStats: ResourceStats;
  wsStats: WsStats;
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

      {/* Redis Cache */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t("monitoring.redisCache")}
          </CardTitle>
          <CardDescription>
            {cacheStats.redisEnabled ? t("monitoring.redisConnected") : t("monitoring.redisDisabled")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-green-600">{cacheStats.redisHits}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.redisHits")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-red-600">{cacheStats.redisMisses}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.redisMisses")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className={`text-2xl font-bold ${cacheStats.redisEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                {cacheStats.redisEnabled ? t("monitoring.redisStatusOn") : t("monitoring.redisStatusOff")}
              </p>
              <p className="text-xs text-muted-foreground">{t("monitoring.status")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Memory & Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t("monitoring.memoryUsage")}
          </CardTitle>
          <CardDescription>
            {t("monitoring.uptime", { time: formatUptime(resourceStats.uptimeSeconds) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{resourceStats.memory.heapUsedMB}MB</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.heapUsed")}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{resourceStats.memory.heapTotalMB}MB</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.heapTotal")}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{resourceStats.memory.rssMB}MB</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.rss")}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{resourceStats.memory.heapUsagePercent}%</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.heapUsage")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Pool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t("monitoring.connectionPool")}
          </CardTitle>
          <CardDescription>{t("monitoring.connectionPoolDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{resourceStats.connectionPool.maxConnections}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.maxConnections")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-green-600">{resourceStats.connectionPool.activeConnections}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.activeConnections")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{resourceStats.connectionPool.idleConnections}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.idleConnections")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WebSocket Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            {t("monitoring.wsConnections")}
          </CardTitle>
          <CardDescription>{t("monitoring.wsConnectionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{wsStats.total}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.wsTotal")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold text-green-600">{wsStats.authenticated}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.wsAuthenticated")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{Object.keys(wsStats.channels).length}</p>
              <p className="text-xs text-muted-foreground">{t("monitoring.wsChannels")}</p>
            </div>
          </div>
          {Object.keys(wsStats.channels).length > 0 && (
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Subscribers</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(wsStats.channels).map(([ch, count]) => (
                    <tr key={ch} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-xs">{ch}</td>
                      <td className="py-1.5">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
