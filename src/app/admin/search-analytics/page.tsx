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
} from "lucide-react";
import { getTranslations } from "@/lib/i18n-server";
import {
  getSearchStats,
  getPopularSearches,
  getZeroResultSearches,
} from "@/lib/search/analytics";

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

  const [stats, popular, zeroResult] = await Promise.all([
    getSearchStats(30),
    getPopularSearches(15, 30),
    getZeroResultSearches(15, 30),
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
    </div>
  );
}
