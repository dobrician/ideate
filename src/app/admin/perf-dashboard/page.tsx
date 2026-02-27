import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldX } from "lucide-react";
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
  const [ciBuilds, ciBuildStats, ciAlertSummary] = await Promise.all([
    getRecentCiBuilds(50),
    getCiBuildStats(50),
    getCiBuildAlertSummary(),
  ]);

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3 sm:mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("analytics.backToAdmin")}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("perfDashboard.title")}</h1>
          <p className="text-muted-foreground">{t("perfDashboard.subtitle")}</p>
        </div>
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
