import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ShieldX,
  Search,
  TrendingUp,
  AlertCircle,
  MousePointerClick,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
} from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import {
  getSearchStats,
  getPopularSearches,
  getZeroResultSearches,
} from "@/lib/search/analytics";
import {
  getSearchQualityStats,
  getSearchFeedbackTrend,
  getLowRatedResults,
} from "@/lib/search/quality";

export default async function SearchAnalyticsPage() {
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

  const [stats, popular, zeroResult, qualityStats, feedbackTrend, lowRated] = await Promise.all([
    getSearchStats(30),
    getPopularSearches(15, 30),
    getZeroResultSearches(15, 30),
    getSearchQualityStats(30),
    getSearchFeedbackTrend(30),
    getLowRatedResults(15, 30),
  ]);

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
          <h1 className="text-2xl font-bold sm:text-3xl">{t("admin.searchAnalytics")}</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Search className="h-4 w-4" />
            {t("admin.totalSearches")}
          </div>
          <div className="text-2xl font-bold">{stats.totalSearches.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            {t("admin.uniqueQueries")}
          </div>
          <div className="text-2xl font-bold">{stats.uniqueQueries.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MousePointerClick className="h-4 w-4" />
            {t("admin.clickThroughRate")}
          </div>
          <div className="text-2xl font-bold">{stats.clickThroughRate.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertCircle className="h-4 w-4" />
            {t("admin.zeroResultRate")}
          </div>
          <div className="text-2xl font-bold">{stats.zeroResultRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Additional stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-2">{t("admin.avgResponseTime")}</h3>
          <div className="text-xl font-bold">{stats.avgResponseTime}ms</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-2">{t("admin.searchesByMode")}</h3>
          <div className="flex gap-4">
            {Object.entries(stats.searchesByMode).map(([mode, count]) => (
              <div key={mode} className="text-sm">
                <span className="text-muted-foreground">{mode}:</span>{" "}
                <span className="font-medium">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Popular Searches */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("admin.popularSearches")}
            </h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {popular.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">{t("admin.noData")}</div>
            ) : (
              popular.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium truncate mr-2">&ldquo;{item.query}&rdquo;</span>
                  <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                    <span>{item.count} searches</span>
                    <span className="text-xs">avg {item.avgResults} results</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Zero-Result Searches */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {t("admin.zeroResultSearches")}
            </h2>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {zeroResult.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">{t("admin.noData")}</div>
            ) : (
              zeroResult.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium truncate mr-2">&ldquo;{item.query}&rdquo;</span>
                  <span className="text-muted-foreground shrink-0">{item.count}x</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Search Feedback Quality Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t("admin.searchFeedback")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{t("admin.searchFeedbackDesc")}</p>

        {/* Feedback Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ThumbsUp className="h-4 w-4" />
              {t("admin.feedbackTotal")}
            </div>
            <div className="text-2xl font-bold">{qualityStats.totalFeedback}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              {t("admin.feedbackPositiveRate")}
            </div>
            <div className={`text-2xl font-bold ${qualityStats.positiveRate >= 70 ? "text-green-600 dark:text-green-400" : qualityStats.positiveRate >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {qualityStats.positiveRate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ThumbsUp className="h-4 w-4 text-green-500" />
              {t("admin.feedbackPositive")}
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Object.values(qualityStats.byMode).reduce((s, m) => s + m.positive, 0)}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              {t("admin.feedbackNegative")}
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {Object.values(qualityStats.byMode).reduce((s, m) => s + m.negative, 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Quality by Mode */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t("admin.feedbackByMode")}
              </h3>
            </div>
            <div className="divide-y">
              {Object.keys(qualityStats.byMode).length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t("admin.noData")}</div>
              ) : (
                Object.entries(qualityStats.byMode).map(([mode, data]) => {
                  const pct = data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0;
                  const modeLabel = mode === "fts" ? t("admin.feedbackModeFts") : mode === "semantic" ? t("admin.feedbackModeSemantic") : t("admin.feedbackModeHybrid");
                  return (
                    <div key={mode} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{modeLabel}</span>
                        <span className="text-sm text-muted-foreground">{data.total} ratings</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${modeLabel} positive rate: ${pct}%`}
                        >
                          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                          <div className="h-full bg-red-400 transition-all" style={{ width: `${100 - pct}%` }} />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{pct}%</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3 text-green-500" /> {data.positive}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsDown className="h-3 w-3 text-red-400" /> {data.negative}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Feedback Trend */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t("admin.feedbackTrend")}
              </h3>
            </div>
            <div className="p-4">
              {feedbackTrend.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("admin.noData")}</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {feedbackTrend.map((day) => {
                    const pct = day.total > 0 ? Math.round((day.positive / day.total) * 100) : 0;
                    return (
                      <div key={day.date} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-muted-foreground shrink-0">{day.date}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                          <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                          <div className="h-full bg-red-400" style={{ width: `${100 - pct}%` }} />
                        </div>
                        <span className="w-16 text-right shrink-0">
                          <span className="text-green-600 dark:text-green-400">{day.positive}</span>
                          /
                          <span className="text-red-500">{day.negative}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Low-Rated Results */}
        <div className="mt-6 rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              {t("admin.feedbackLowRated")}
            </h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {lowRated.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">{t("admin.feedbackNoLowRated")}</div>
            ) : (
              lowRated.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 text-sm gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">&ldquo;{item.query}&rdquo;</div>
                    <div className="text-xs text-muted-foreground">
                      {t("admin.feedbackResultType")}: <span className="capitalize">{item.resultType}</span> &middot; ID: {item.resultId.slice(0, 8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-red-500">
                      <ThumbsDown className="h-3 w-3" /> {item.negativeCount}
                    </span>
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <ThumbsUp className="h-3 w-3" /> {item.positiveCount}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
