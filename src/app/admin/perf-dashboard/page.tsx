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
import { getRecentCiBuilds, getCiBuildStats } from "@/lib/ci-builds";

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
  const [ciBuilds, ciBuildStats] = await Promise.all([
    getRecentCiBuilds(50),
    getCiBuildStats(50),
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
    </div>
  );
}
