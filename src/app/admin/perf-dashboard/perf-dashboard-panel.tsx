"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";
import type { PerfStats } from "@/lib/perf-monitor";
import type { ResourceStats } from "@/lib/resource-monitor";
import type { PerfAlert, AlertSeverity } from "@/lib/perf-alerts";
import {
  Activity, Database, HardDrive, AlertTriangle, Gauge,
  Layers, Clock, MemoryStick,
} from "lucide-react";

interface Props {
  perfStats: PerfStats;
  cacheStats: { hits: number; misses: number; hitRate: number; memEntries: number; redisHits: number; redisEnabled: boolean };
  resourceStats: ResourceStats;
  poolStats: { maxConnections: number; activeConnections: number; idleConnections: number; totalAcquired: number; totalReleased: number; peakActive: number };
  stmtStats: { totalCached: number; maxCapacity: number; topStatements: { sql: string; useCount: number }[] };
  tagStats: { totalTags: number; totalTrackedKeys: number };
  alertCounts: Record<AlertSeverity, number>;
  recentAlerts: PerfAlert[];
}

function StatCard({ icon: Icon, title, value, subtitle }: {
  icon: typeof Activity;
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function PerfDashboardPanel({
  perfStats, cacheStats, resourceStats, poolStats, stmtStats, tagStats,
  alertCounts, recentAlerts,
}: Props) {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} title={t("perfDashboard.avgResponse")} value={`${perfStats.avgResponseMs}ms`} subtitle={`P95: ${perfStats.p95ResponseMs}ms | P99: ${perfStats.p99ResponseMs}ms`} />
        <StatCard icon={Gauge} title={t("perfDashboard.cacheHitRate")} value={`${cacheStats.hitRate}%`} subtitle={`${cacheStats.hits} hits / ${cacheStats.misses} misses`} />
        <StatCard icon={MemoryStick} title={t("perfDashboard.memoryUsage")} value={`${resourceStats.memory.heapUsedMB} MB`} subtitle={`${resourceStats.memory.heapUsagePercent}% of ${resourceStats.memory.heapTotalMB} MB`} />
        <StatCard icon={AlertTriangle} title={t("perfDashboard.activeAlerts")} value={alertCounts.critical + alertCounts.warning} subtitle={`${alertCounts.critical} critical, ${alertCounts.warning} warning`} />
      </div>

      {/* Database & Cache Section */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> {t("perfDashboard.dbPool")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{t("perfDashboard.maxConn")}</span><span className="font-mono">{poolStats.maxConnections}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.activeConn")}</span><span className="font-mono">{poolStats.activeConnections}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.idleConn")}</span><span className="font-mono">{poolStats.idleConnections}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.peakActive")}</span><span className="font-mono">{poolStats.peakActive}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.totalAcquired")}</span><span className="font-mono">{poolStats.totalAcquired}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.stmtsCached")}</span><span className="font-mono">{stmtStats.totalCached}/{stmtStats.maxCapacity}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> {t("perfDashboard.cacheDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{t("perfDashboard.memEntries")}</span><span className="font-mono">{cacheStats.memEntries}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.redisEnabled")}</span><span className="font-mono">{cacheStats.redisEnabled ? "Yes" : "No"}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.redisHits")}</span><span className="font-mono">{cacheStats.redisHits}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.trackedTags")}</span><span className="font-mono">{tagStats.totalTags}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.taggedKeys")}</span><span className="font-mono">{tagStats.totalTrackedKeys}</span></div>
            <div className="flex justify-between"><span>{t("perfDashboard.totalRequests")}</span><span className="font-mono">{perfStats.totalRequests}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Slowest Paths */}
      {perfStats.slowestPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> {t("perfDashboard.slowestPaths")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {perfStats.slowestPaths.map((p) => (
                <div key={p.path} className="flex justify-between font-mono">
                  <span className="truncate">{p.path}</span>
                  <span className="ml-2 shrink-0">{p.avgMs}ms ({p.count}x)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      {recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" /> {t("perfDashboard.recentAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className={`flex items-start justify-between rounded p-2 ${alert.severity === "critical" ? "bg-destructive/10" : "bg-yellow-500/10"}`}>
                  <div>
                    <span className={`font-medium ${alert.severity === "critical" ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"}`}>
                      [{alert.severity.toUpperCase()}]
                    </span>{" "}
                    {alert.message}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
