import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldX, Download } from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import { getPerfStats } from "@/lib/perf-monitor";
import { getCacheStats } from "@/lib/cache";
import { getResourceStats } from "@/lib/resource-monitor";
import { getPoolStats } from "@/db";
import { getStatementCacheStats } from "@/lib/db/statement-cache";
import { getTagStats } from "@/lib/cache/tags";
import { getAlerts, getAlertCounts } from "@/lib/perf-alerts";
import { PerfDashboardPanel } from "./perf-dashboard-panel";
import { CiBuildTrendsPanel } from "./ci-build-trends";
import { getRecentCiBuilds, getCiBuildStats, getCiBuildAlertSummary } from "@/lib/ci-builds";
import { getBundleSizeAnalytics, checkBundleSizeRegression } from "@/lib/bundle-tracker";
import { getAvailableBranches, compareBranches } from "@/lib/ci-build-comparison";

export default async function PerfDashboardPage() {
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

  const perfStats = getPerfStats();
  const cacheStats = getCacheStats();
  const resourceStats = getResourceStats();
  const poolStats = getPoolStats();
  const stmtStats = getStatementCacheStats();
  const tagStats = getTagStats();
  const alertCounts = getAlertCounts();
  const recentAlerts = getAlerts().slice(-10).reverse();
  const [ciBuilds, ciBuildStats, ciAlertSummary, bundleAnalytics, bundleRegression, branches] = await Promise.all([
    getRecentCiBuilds(50),
    getCiBuildStats(50),
    getCiBuildAlertSummary(),
    getBundleSizeAnalytics(),
    checkBundleSizeRegression(),
    getAvailableBranches(),
  ]);

  // Compare top 2 branches if available
  const branchComparison = branches.length >= 2
    ? await compareBranches(branches[0], branches[1])
    : null;

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("analytics.backToAdmin")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("perfDashboard.title")}</h1>
          <p className="text-muted-foreground">{t("perfDashboard.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/admin/export/ci-builds" download>
            <Download className="mr-1 h-4 w-4" />
            {t("admin.exportCsv")}
          </a>
        </Button>
      </div>

      <PerfDashboardPanel
        perfStats={perfStats}
        cacheStats={cacheStats}
        resourceStats={resourceStats}
        poolStats={poolStats}
        stmtStats={stmtStats}
        tagStats={tagStats}
        alertCounts={alertCounts}
        recentAlerts={recentAlerts}
      />

      <div className="mt-8">
        <CiBuildTrendsPanel builds={ciBuilds} stats={ciBuildStats} />
      </div>

      {/* Bundle Size Tracking */}
      {bundleAnalytics.current && (
        <div className="mt-6 rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">{t("perfDashboard.bundleSize")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground mb-1">{t("perfDashboard.bundleCurrent")}</div>
              <div className="text-xl font-bold">{bundleAnalytics.current.sizeMb} MB</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground mb-1">{t("perfDashboard.bundleTrend")}</div>
              <div className={`text-lg font-bold ${bundleAnalytics.trend === "growing" ? "text-red-500" : bundleAnalytics.trend === "shrinking" ? "text-green-500" : ""}`}>
                {bundleAnalytics.trend === "growing" ? "Growing" : bundleAnalytics.trend === "shrinking" ? "Shrinking" : bundleAnalytics.trend === "stable" ? "Stable" : "N/A"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground mb-1">{t("perfDashboard.bundleBudget")}</div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={bundleAnalytics.budgetStatus.sizeUsagePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${t("perfDashboard.bundleBudget")}: ${bundleAnalytics.budgetStatus.sizeUsagePct}%`}
                >
                  <div
                    className={`h-full rounded-full ${bundleAnalytics.budgetStatus.sizeWithinBudget ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(bundleAnalytics.budgetStatus.sizeUsagePct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{bundleAnalytics.budgetStatus.sizeUsagePct}%</span>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-muted-foreground mb-1">{t("perfDashboard.bundleDuration")}</div>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={bundleAnalytics.budgetStatus.durationUsagePct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${t("perfDashboard.bundleDuration")}: ${bundleAnalytics.budgetStatus.durationUsagePct}%`}
                >
                  <div
                    className={`h-full rounded-full ${bundleAnalytics.budgetStatus.durationWithinBudget ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(bundleAnalytics.budgetStatus.durationUsagePct, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{bundleAnalytics.budgetStatus.durationUsagePct}%</span>
              </div>
            </div>
          </div>
          {bundleRegression.regression && (
            <div className="px-4 pb-4">
              <p className="text-sm text-red-600 dark:text-red-400">{bundleRegression.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Branch Comparison */}
      {branchComparison && (
        <div className="mt-6 rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">{t("admin.ciBuildComparison")}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t("admin.ciBuildComparisonDesc")}</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Branch A */}
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">{t("admin.branchA")}: <span className="font-mono">{branchComparison.branchA.branch}</span></h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Builds</span>
                    <span className="font-medium">{branchComparison.branchA.buildCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.buildDuration")}</span>
                    <span className="font-medium">{(branchComparison.branchA.avgDurationMs / 1000).toFixed(1)}s</span>
                  </div>
                  {branchComparison.branchA.avgSizeBytes !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("admin.buildSize")}</span>
                      <span className="font-medium">{(branchComparison.branchA.avgSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.buildStatus")}</span>
                    <span className={`font-medium ${branchComparison.branchA.successRate >= 90 ? "text-green-600 dark:text-green-400" : branchComparison.branchA.successRate >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {branchComparison.branchA.successRate}% pass
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch B */}
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">{t("admin.branchB")}: <span className="font-mono">{branchComparison.branchB.branch}</span></h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Builds</span>
                    <span className="font-medium">{branchComparison.branchB.buildCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.buildDuration")}</span>
                    <span className="font-medium">{(branchComparison.branchB.avgDurationMs / 1000).toFixed(1)}s</span>
                  </div>
                  {branchComparison.branchB.avgSizeBytes !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("admin.buildSize")}</span>
                      <span className="font-medium">{(branchComparison.branchB.avgSizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("admin.buildStatus")}</span>
                    <span className={`font-medium ${branchComparison.branchB.successRate >= 90 ? "text-green-600 dark:text-green-400" : branchComparison.branchB.successRate >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {branchComparison.branchB.successRate}% pass
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Summary */}
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-lg border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("admin.durationDiff")}:</span>{" "}
                <span className={`font-medium ${branchComparison.durationDiffPct > 5 ? "text-red-600 dark:text-red-400" : branchComparison.durationDiffPct < -5 ? "text-green-600 dark:text-green-400" : ""}`}>
                  {branchComparison.durationDiffPct > 0 ? "+" : ""}{branchComparison.durationDiffPct}%
                </span>
              </div>
              {branchComparison.sizeDiffPct !== null && (
                <div className="rounded-lg border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t("admin.sizeDiff")}:</span>{" "}
                  <span className={`font-medium ${branchComparison.sizeDiffPct > 5 ? "text-red-600 dark:text-red-400" : branchComparison.sizeDiffPct < -5 ? "text-green-600 dark:text-green-400" : ""}`}>
                    {branchComparison.sizeDiffPct > 0 ? "+" : ""}{branchComparison.sizeDiffPct}%
                  </span>
                </div>
              )}
              <div className="rounded-lg border px-3 py-2 text-sm">
                <span className="text-muted-foreground">Success Rate Diff:</span>{" "}
                <span className={`font-medium ${branchComparison.successRateDiff > 0 ? "text-green-600 dark:text-green-400" : branchComparison.successRateDiff < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {branchComparison.successRateDiff > 0 ? "+" : ""}{branchComparison.successRateDiff}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CI Alert Summary */}
      {ciAlertSummary.currentAlert.alert && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <span className="font-semibold">{t("perfDashboard.ciAlert")}</span>
          </div>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            {ciAlertSummary.currentAlert.message}
          </p>
          {ciAlertSummary.currentAlert.details && (
            <div className="mt-2 flex gap-4 text-xs text-red-500 dark:text-red-400">
              <span>{t("perfDashboard.ciAlertRecent")}: {ciAlertSummary.currentAlert.details.avgRecentMs}ms</span>
              <span>{t("perfDashboard.ciAlertBaseline")}: {ciAlertSummary.currentAlert.details.avgBaselineMs}ms</span>
            </div>
          )}
        </div>
      )}
      {ciAlertSummary.recentFailures > 0 && !ciAlertSummary.currentAlert.alert && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t("perfDashboard.ciFailures").replace("{count}", String(ciAlertSummary.recentFailures)).replace("{total}", String(ciAlertSummary.totalBuilds))}
          </p>
        </div>
      )}
    </div>
  );
}
